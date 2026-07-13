import sharp from "sharp";
import {
  invokeAnthropicLLM,
  parseClaudeJsonResponse,
  type AnthropicContent,
  type AnthropicImageContent,
} from "./anthropicClient";
import { ENV } from "./env";

export interface InstagramStyleResult {
  // ── Campos usados pelo editor de carrossel (não remover) ──────────────
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

  // ── Posts analisados (para exibição na UI) ────────────────────────────
  rawPostImageUrls?: string[];

  // ── Identidade do perfil ───────────────────────────────────────────────
  niche?: string;
  targetAudience?: string;
  objective?: string;

  // ── Paleta de cores ampliada ───────────────────────────────────────────
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;

  // ── Tipografia ────────────────────────────────────────────────────────
  secondaryFont?: string;
  fontWeight?: string;

  // ── Padrões visuais ───────────────────────────────────────────────────
  layoutPattern?: string;
  editingStyle?: string;
  recurringElements?: string;
  postStructure?: string;
  visualEffects?: string;

  // ── Estratégia de conteúdo ────────────────────────────────────────────
  copyType?: string;
  captionStructure?: string;
  ctaExamples?: string[];
  language?: string;
  frequentEmojis?: string;

  // ── Design dos slides de carrossel ───────────────────────────────────
  coverSlideStyle?: {
    bgColor: string;
    accentColor: string;
    titleAlign: "left" | "center";
    description: string;
  };
  contentSlideStyle?: {
    bgColor: string;
    accentColor: string;
    titleAlign: "left" | "center";
    description: string;
  };
  ctaSlideStyle?: {
    bgColor: string;
    accentColor: string;
    description: string;
  };

  // ── Branding ─────────────────────────────────────────────────────────
  brandKeywords?: string[];
  designTokens?: {
    "--color-primary": string;
    "--color-secondary": string;
    "--color-bg": string;
    "--color-text": string;
    "--color-accent": string;
    "--font-primary": string;
    "--font-secondary": string;
    "--border-radius": string;
    "--spacing-unit": string;
  };
}

interface RawProfile {
  username: string;
  name?: string;
  profilePictureUrl?: string;
  postImageUrls: string[];
}

// Result from attempting to load one image
interface ImageLoadResult {
  // Block to send to Claude (base64 preferred, URL fallback)
  block: AnthropicImageContent;
  // If we have the actual bytes (server-side download succeeded), this is the data URL
  dataUrl?: string;
  // The original CDN URL (always present for display fallback)
  cdnUrl: string;
}

// Try to download a buffer from `url` using the provided headers.
async function tryDirectDownload(
  url: string,
  headers: Record<string, string>
): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("image/") && !ct.includes("octet-stream")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength >= 2_000 ? buf : null; // < 2KB → placeholder/logo, skip
  } catch {
    return null;
  }
}

// Build the wsrv.nl proxy URL for a CDN image — used both for server-side download
// AND as the URL block sent to Anthropic when server-side download fails.
// wsrv.nl has full internet access and is not blocked by Instagram/Facebook CDN.
function toProxyUrl(cdnUrl: string): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(cdnUrl)}&output=jpg&n=-1`;
}

// Try downloading via wsrv.nl — bypasses CDN IP blocks on cloud/VPS hosts.
async function tryProxyDownload(url: string): Promise<Buffer | null> {
  const proxyUrls = [
    toProxyUrl(url),
    // Second attempt: images.weserv.nl (same service, different domain/IP pool)
    `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&n=-1`,
  ];
  for (const proxyUrl of proxyUrls) {
    try {
      const res = await fetch(proxyUrl, {
        headers: { "User-Agent": "Mozilla/5.0 compatible" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("image/") && !ct.includes("octet-stream")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength >= 2_000) return buf;
    } catch {
      continue;
    }
  }
  return null;
}

function bufferToImageResult(buf: Buffer, cdnUrl: string): ImageLoadResult {
  const data = buf.toString("base64");
  const safeMime = "image/jpeg" as const;
  return {
    block: { type: "image", source: { type: "base64", media_type: safeMime, data } },
    dataUrl: `data:${safeMime};base64,${data}`,
    cdnUrl,
  };
}

// Download image server-side → base64, with multiple fallback strategies:
//   1. Direct download (3 header variants)
//   2. Via wsrv.nl proxy (bypasses CDN IP blocks on cloud/VPS hosts)
//   3. URL block for Anthropic to fetch directly (last resort)
async function loadImage(url: string): Promise<ImageLoadResult | null> {
  const directStrategies: Record<string, string>[] = [
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://www.instagram.com/",
    },
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "image/*,*/*;q=0.8",
    },
    {
      "User-Agent":
        "Instagram 155.0.0.37.107 Android (23/6.0.1; 320dpi; 720x1280; samsung; SM-A310F; a3xelte; samsungexynos7580; en_GB; 239490550)",
      Accept: "image/*,*/*;q=0.8",
    },
  ];

  // Strategy 1–3: Direct download
  for (const headers of directStrategies) {
    const buf = await tryDirectDownload(url, headers);
    if (buf) {
      if (buf.byteLength > 6 * 1024 * 1024) break; // too large even if valid
      console.log(`[StyleAgent] ✅ Direct download ${Math.round(buf.byteLength / 1024)}KB: ${url.slice(0, 70)}`);
      return bufferToImageResult(buf, url);
    }
  }

  // Strategy 4: Proxy via wsrv.nl
  const proxyBuf = await tryProxyDownload(url);
  if (proxyBuf) {
    console.log(`[StyleAgent] ✅ Proxy download ${Math.round(proxyBuf.byteLength / 1024)}KB: ${url.slice(0, 70)}`);
    return bufferToImageResult(proxyBuf, url);
  }

  // Strategy 5: URL block via wsrv.nl proxy — Anthropic's servers fetch through wsrv.nl,
  // which has full internet access and can always reach Instagram/Facebook CDN.
  // This is more reliable than passing the raw CDN URL directly.
  const proxyUrl = toProxyUrl(url);
  console.warn(`[StyleAgent] ⚠️ Server download failed — passing proxy URL to Claude: ${proxyUrl.slice(0, 80)}`);
  return { block: { type: "image", source: { type: "url", url: proxyUrl } }, cdnUrl: url };
}

// Fetch the authenticated user's OWN profile via Graph API.
// We prefer IMAGE posts and CAROUSEL slides over video thumbnails because
// photos are random frames from videos and don't reflect brand identity colors.
async function fetchOwnProfileViaGraphApi(
  instagramAccountId: string,
  accessToken: string
): Promise<RawProfile> {
  const base = `${ENV.metaGraphApiBaseUrl}/${ENV.metaGraphApiVersion}`;

  // Request carousel children so we can pull individual slide images (brand graphics are often in carousels)
  const mediaFields = "media_url,thumbnail_url,media_type,timestamp,children{media_url,media_type}";

  const [profileRes, mediaRes] = await Promise.allSettled([
    fetch(
      `${base}/${instagramAccountId}?fields=name,username,profile_picture_url&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(12_000) }
    ),
    fetch(
      // Fetch 25 items so we're more likely to find IMAGE/CAROUSEL posts (not just videos)
      `${base}/${instagramAccountId}/media?fields=${mediaFields}&limit=25&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(15_000) }
    ),
  ]);

  type ChildItem = { media_url?: string; media_type?: string };
  type MediaItem = {
    media_url?: string;
    thumbnail_url?: string;
    media_type?: string;
    timestamp?: string;
    children?: { data?: ChildItem[] };
  };
  type ProfileJson = { name?: string; username?: string; profile_picture_url?: string; error?: { code: number; message: string } };
  type MediaJson = { data?: MediaItem[]; error?: { code: number; message: string } };

  let profile: ProfileJson = {};
  if (profileRes.status === "fulfilled") {
    const body = (await profileRes.value.json()) as ProfileJson;
    if (body.error) {
      console.error(`[StyleAgent] Graph API profile error: code=${body.error.code} — ${body.error.message}`);
    } else {
      profile = body;
    }
  }

  let mediaItems: MediaItem[] = [];
  if (mediaRes.status === "fulfilled") {
    const body = (await mediaRes.value.json()) as MediaJson;
    if (body.error) {
      console.error(`[StyleAgent] Graph API media error: code=${body.error.code} — ${body.error.message}`);
    } else {
      mediaItems = body.data ?? [];
    }
  }

  // Build URL list, strongly preferring IMAGE content over video thumbnails.
  // Carousels expose individual slide images via children{media_url}.
  // Brand colors live in graphic/design images, not in random video frames.
  const imageUrls: string[] = [];   // IMAGE posts and carousel slides (best for color extraction)
  const videoThumbs: string[] = []; // VIDEO thumbnails (fallback only)

  for (const item of mediaItems) {
    if (item.media_type === "CAROUSEL_ALBUM") {
      // Pull each carousel slide image
      for (const child of item.children?.data ?? []) {
        if (child.media_url?.startsWith("http") && child.media_type !== "VIDEO") {
          imageUrls.push(child.media_url);
        }
      }
      // Also keep the cover if no children came back
      if (item.media_url?.startsWith("http")) {
        imageUrls.push(item.media_url);
      }
    } else if (item.media_type === "IMAGE" && item.media_url?.startsWith("http")) {
      imageUrls.push(item.media_url);
    } else if (item.media_type === "VIDEO" && item.thumbnail_url?.startsWith("http")) {
      videoThumbs.push(item.thumbnail_url);
    }
  }

  // Use image posts first; fill remaining slots with video thumbnails (up to 3 video thumbs)
  const postImageUrls = [
    ...imageUrls.slice(0, 9),
    ...videoThumbs.slice(0, Math.max(0, 3 - imageUrls.length)),
  ].slice(0, 12);

  console.log(
    `[StyleAgent] Graph API: username="${profile.username}", images=${imageUrls.length}, videoThumbs=${videoThumbs.length}, selected=${postImageUrls.length}`
  );

  return {
    username: profile.username ?? "",
    name: profile.name,
    profilePictureUrl: profile.profile_picture_url,
    postImageUrls,
  };
}

// Last-resort HTML scraping. Usually only yields og:image (profile pic), rarely post images.
async function fetchPublicProfilePage(username: string): Promise<Partial<RawProfile>> {
  try {
    const res = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(14_000),
    });
    if (!res.ok) {
      console.warn(`[StyleAgent] HTML scrape: HTTP ${res.status} for @${username}`);
      return {};
    }
    const html = await res.text();

    const ogImage = html
      .match(/<meta property="og:image" content="([^"]+)"/)?.[1]
      ?.replace(/&amp;/g, "&");

    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "";
    const name = ogTitle.match(/^([^(@•|]+)/)?.[1]?.trim() || undefined;

    const ogDesc =
      html
        .match(/<meta property="og:description" content="([^"]+)"/)?.[1]
        ?.replace(/&amp;/g, "&")
        ?.replace(/&#39;/g, "'")
        ?.replace(/&quot;/g, '"') || "";

    // Only scontent CDN (actual user media) with /v/ path — excludes static.cdninstagram.com
    const postImageUrls: string[] = [];
    const cdnPattern =
      /https:\/\/scontent[^"' ]*\.cdninstagram\.com\/v\/[^"' ]+\.(?:jpg|jpeg|png|webp)/gi;
    const allCdnUrls = Array.from(html.matchAll(cdnPattern)).map((m) => m[0]);
    const seen = new Set<string>();
    for (const url of allCdnUrls) {
      if (/[_/]s\d{2,3}x\d{2,3}[_/]/.test(url)) continue;
      if (seen.has(url) || url === ogImage) continue;
      seen.add(url);
      postImageUrls.push(url);
      if (postImageUrls.length >= 9) break;
    }

    console.log(`[StyleAgent] HTML scrape: pic=${!!ogImage}, posts=${postImageUrls.length} for @${username}`);

    return {
      username,
      name: ogDesc ? `${name ?? username} — ${ogDesc.slice(0, 120)}` : name,
      profilePictureUrl: ogImage,
      postImageUrls,
    };
  } catch (err) {
    console.warn(`[StyleAgent] HTML scrape failed for @${username}:`, err);
    return { username };
  }
}

// Convert a data URL or HTTP URL into an AnthropicImageContent block.
function dataUrlToBlock(dataUrl: string): AnthropicImageContent | null {
  if (dataUrl.startsWith("data:")) {
    const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/s);
    if (!m) return null;
    const mime = m[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    return { type: "image", source: { type: "base64", media_type: mime, data: m[2] } };
  }
  if (dataUrl.startsWith("https://") || dataUrl.startsWith("http://")) {
    return { type: "image", source: { type: "url", url: dataUrl } };
  }
  return null;
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
  // Accepts both data: URIs (screenshots from client) and HTTP URLs
  uploadedImages?: string[];
  /** @deprecated use uploadedImages */
  uploadedImageUrls?: string[];
}): Promise<InstagramStyleResult> {
  const { username, connectedAccount } = params;
  const uploadedImages = params.uploadedImages ?? params.uploadedImageUrls ?? [];
  const cleanUsername = username
    .replace(/^@/, "")
    .replace(/.*instagram\.com\//, "")
    .replace(/\/.*$/, "")
    .split("?")[0]
    .trim()
    .toLowerCase();

  console.log(`[StyleAgent] Analyzing @${cleanUsername} — connected account: ${connectedAccount?.instagramAccountId ?? "none"}`);

  let profile: RawProfile = { username: cleanUsername, postImageUrls: [] };

  // ── Step 1: Graph API for connected account ───────────────────────────────────
  if (connectedAccount) {
    try {
      const apiData = await fetchOwnProfileViaGraphApi(
        connectedAccount.instagramAccountId,
        connectedAccount.accessToken
      );

      const apiUsername = apiData.username.toLowerCase();
      const storedUsername = (connectedAccount.username ?? "").toLowerCase();

      // Use Graph API data if: API or stored username confirms this is the requested profile
      const isMatch =
        (apiUsername && apiUsername === cleanUsername) ||
        (storedUsername && storedUsername === cleanUsername);

      if (isMatch && apiData.postImageUrls.length > 0) {
        profile = {
          username: cleanUsername,
          name: apiData.name ?? connectedAccount.name ?? undefined,
          profilePictureUrl:
            apiData.profilePictureUrl ?? connectedAccount.profilePictureUrl ?? undefined,
          postImageUrls: apiData.postImageUrls,
        };
        console.log(`[StyleAgent] ✅ Graph API match for @${cleanUsername}: ${profile.postImageUrls.length} posts`);
      } else if (apiData.postImageUrls.length === 0) {
        // Graph API returned no posts — maybe a permissions issue
        console.warn(`[StyleAgent] ⚠️ Graph API returned 0 posts for account ${connectedAccount.instagramAccountId}. Check instagram_content_publish permission.`);
        // Still use profile metadata if available
        if (apiData.profilePictureUrl || connectedAccount.profilePictureUrl) {
          profile.profilePictureUrl =
            apiData.profilePictureUrl ?? connectedAccount.profilePictureUrl ?? undefined;
        }
      } else {
        console.warn(`[StyleAgent] ⚠️ Graph API username mismatch: api="${apiUsername}", stored="${storedUsername}", requested="${cleanUsername}"`);
      }
    } catch (err) {
      console.error(`[StyleAgent] ❌ Graph API exception:`, err);
    }
  }

  // ── Step 2: HTML scraping fallback (external profiles or Graph API miss) ──────
  if (profile.postImageUrls.length === 0) {
    const pub = await fetchPublicProfilePage(cleanUsername);
    profile = {
      username: cleanUsername,
      name: profile.name ?? pub.name,
      profilePictureUrl: profile.profilePictureUrl ?? pub.profilePictureUrl,
      postImageUrls: pub.postImageUrls ?? [],
    };
  }

  // ── Step 3: Build image blocks ────────────────────────────────────────────────
  // Uploaded images (data URLs or HTTP URLs) come first — user-provided reference is highest priority
  const uploadedBlocks: AnthropicImageContent[] = uploadedImages
    .map(dataUrlToBlock)
    .filter((b): b is AnthropicImageContent => b !== null)
    .slice(0, 8);

  // CDN URLs from Graph API or HTML scraping go through the download pipeline
  const allImageUrls = [
    profile.profilePictureUrl,
    ...profile.postImageUrls,
  ].filter((u): u is string => !!u && u.startsWith("http"));

  console.log(`[StyleAgent] Loading ${allImageUrls.length} image URLs for @${cleanUsername}`);

  const loadResults = await Promise.allSettled(
    allImageUrls.slice(0, 10).map((url) => loadImage(url))
  );

  // Persist profile picture as data URL (never expires)
  let profilePictureDataUrl: string | undefined;
  const picIsFirst =
    !!profile.profilePictureUrl && allImageUrls[0] === profile.profilePictureUrl;
  if (picIsFirst) {
    const r = loadResults[0];
    if (r.status === "fulfilled" && r.value?.dataUrl) {
      profilePictureDataUrl = r.value.dataUrl;
    }
  }

  // Build Claude image blocks and UI thumbnail data URLs
  // Uploaded blocks come first so Claude sees user-provided reference immediately
  const imageBlocks: AnthropicImageContent[] = [...uploadedBlocks];
  const rawPostDataUrls: string[] = [];
  const postStartIndex = picIsFirst ? 1 : 0;
  let serverDownloadsSucceeded = 0;
  let urlFallbacksUsed = 0;

  for (let i = 0; i < loadResults.length; i++) {
    const r = loadResults[i];
    if (r.status !== "fulfilled" || !r.value) continue;
    const result = r.value;

    imageBlocks.push(result.block);

    if (i >= postStartIndex && rawPostDataUrls.length < 6) {
      if (result.dataUrl) {
        // Server successfully downloaded → create 480×480 JPEG thumbnail
        serverDownloadsSucceeded++;
        try {
          const buf = Buffer.from(result.dataUrl.split(",")[1], "base64");
          const thumb = await sharp(buf)
            .resize(480, 480, { fit: "cover", position: "centre" })
            .jpeg({ quality: 80 })
            .toBuffer();
          rawPostDataUrls.push(`data:image/jpeg;base64,${thumb.toString("base64")}`);
        } catch {
          rawPostDataUrls.push(result.dataUrl);
        }
      } else {
        // Server download failed → use raw CDN URL for UI (browser can load it)
        urlFallbacksUsed++;
        rawPostDataUrls.push(result.cdnUrl);
      }
    }
  }

  console.log(
    `[StyleAgent] @${cleanUsername}: ${imageBlocks.length} Claude blocks (${serverDownloadsSucceeded} base64, ${urlFallbacksUsed} URL fallback), ${rawPostDataUrls.length} UI thumbnails`
  );

  // Detect placeholder/logo: if 2+ thumbnails share the same fingerprint → identical images
  if (rawPostDataUrls.length >= 2) {
    const dataUrlThumbs = rawPostDataUrls.filter((u) => u.startsWith("data:"));
    if (dataUrlThumbs.length >= 2) {
      const fingerprint = (url: string) => url.slice(23, 300);
      const first = fingerprint(dataUrlThumbs[0]);
      const allIdentical = dataUrlThumbs.every((u) => fingerprint(u) === first);
      if (allIdentical) {
        console.warn(`[StyleAgent] All ${dataUrlThumbs.length} thumbnails identical → placeholder detected, discarding`);
        rawPostDataUrls.length = 0;
      }
    }
  }

  // ── Step 4: Build Claude prompt ───────────────────────────────────────────────
  const profileDesc = profile.name
    ? `@${cleanUsername} (${profile.name})`
    : `@${cleanUsername}`;

  const systemPrompt = `Você é um agente especialista em extração de identidade visual e branding de perfis do Instagram.

Seu objetivo é identificar com precisão as CORES DE MARCA e a identidade visual do perfil a partir das imagens enviadas.

# REGRA PRINCIPAL SOBRE CORES — LEIA COM ATENÇÃO

## O QUE SÃO CORES DE MARCA (use estas):
- Cor do logo ou símbolo da marca
- Cor do fundo de elementos gráficos (banners, cards, carrosseis)
- Cor de texto em títulos e chamadas (não em fotos)
- Cor de botões, ícones ou formas geométricas desenhadas
- Cor de molduras, bordas, overlays sobre as fotos
- Cor que aparece de forma CONSISTENTE em múltiplos posts
- Cor do fundo de slides de carrossel

## O QUE NÃO SÃO CORES DE MARCA (ignore estas):
- Cor do céu em fotos externas
- Cor de pele de pessoas fotografadas
- Cor de vegetação ou ambiente natural
- Cor de paredes ou superfícies no background de fotos
- Qualquer cor que aparece apenas em 1 imagem e não se repete

## PROCESSO DE ANÁLISE
1. Observe TODAS as imagens enviadas
2. Identifique quais elementos aparecem de forma repetida (logo, fundo, texto, moldura)
3. Extraia a cor HEX EXATA desses elementos repetidos — esses são os brand colors
4. Se houver gráficos/carrosseis nas imagens, priorize as cores deles
5. Analise a tipografia nos textos sobrepostos às imagens (não o texto das fotos)

## REGRAS CRÍTICAS
- Retorne APENAS JSON válido, sem texto antes ou depois
- Cores SEMPRE em formato #RRGGBB baseado em elementos GRÁFICOS repetidos — NUNCA em fundos fotográficos
- Jamais use cores completamente genéricas como #000000 ou #ffffff a menos que realmente dominam os elementos gráficos
- Se uma imagem não estiver disponível, indique no styleSummary
- Priorize CONSISTÊNCIA entre posts: a cor que aparece em 3+ posts é brand color`;

  const jsonSchema = `{
  "accentColor": "#RRGGBB — cor de destaque consistente entre posts: logo, ícone da marca, botão, elemento gráfico colorido. NÃO use cor de fundo fotográfico",
  "bgColor": "#RRGGBB — cor de fundo dos elementos GRÁFICOS (slides, cards, banners) — NÃO o céu ou parede de fotos",
  "primaryColor": "#RRGGBB — cor que representa melhor a marca, que aparece no logo ou em elementos repetidos em vários posts",
  "secondaryColor": "#RRGGBB — segunda cor que aparece de forma recorrente como complemento à cor primária nos gráficos",
  "textColor": "#RRGGBB — cor do texto sobreposto às imagens ou usado em slides — NÃO cor de texto em fotos de documentos",
  "fontFamily": "uma das opções: 'system-ui, -apple-system, sans-serif' | 'Georgia, Times New Roman, serif' | 'Impact, Arial Black, sans-serif' | 'Courier New, Courier, monospace' | 'Helvetica Neue, Helvetica, Arial, sans-serif'",
  "secondaryFont": "descrição da fonte secundária observada visualmente (ex: 'sans-serif leve')",
  "fontWeight": "descrição do peso visual (ex: 'bold com contraste alto', 'light minimalista')",
  "titleAlign": "left ou center",
  "titleSize": número entre 0.8 e 1.2,
  "profileName": "nome real do perfil",
  "profileHandle": "@handle",
  "niche": "nicho do perfil (ex: 'Marketing Digital', 'Fitness', 'Gastronomia', 'Moda')",
  "targetAudience": "público-alvo deduzido (ex: 'Empreendedores 25-40 anos', 'Jovens fitness 18-30')",
  "objective": "objetivo comercial do perfil (ex: 'Vender cursos', 'Gerar leads', 'Construir autoridade')",
  "layoutPattern": "padrão de layout predominante (ex: 'grade uniforme com fundo neutro', 'mosaico colorido alternado')",
  "editingStyle": "estilo de edição das fotos/vídeos (ex: 'tons quentes saturados', 'preto e branco com contraste alto', 'flat lay minimalista')",
  "recurringElements": "elementos visuais que se repetem (ex: 'moldura branca, ícones de linha, texto centralizado')",
  "postStructure": "estrutura típica dos posts (ex: 'imagem impactante + texto curto + CTA', 'carrossel educativo com múltiplos slides')",
  "visualEffects": "efeitos visuais detectados (ex: 'gradientes suaves, sombra drop shadow leve', 'sem efeitos, flat design')",
  "copyType": "tipo de copy predominante (ex: 'educacional direto', 'emocional storytelling', 'provocativo com pergunta')",
  "captionStructure": "estrutura das legendas deduzida (ex: 'gancho + desenvolvimento + CTA + hashtags')",
  "ctaExamples": ["array com exemplos de CTA que o perfil provavelmente usa"],
  "language": "tom e linguagem (ex: 'informal e próximo com gírias', 'formal e técnico', 'inspiracional e motivacional')",
  "frequentEmojis": "emojis que o perfil provavelmente usa com base no estilo (ex: '🔥💡✅🎯')",
  "coverSlideStyle": {
    "bgColor": "#RRGGBB — cor de fundo predominante nas capas dos carrosseis",
    "accentColor": "#RRGGBB — cor de destaque usada nas capas",
    "titleAlign": "left ou center — alinhamento do título na capa",
    "description": "1-2 frases sobre o design da capa (ex: 'fundo escuro com imagem full-bleed e título grande centralizado')"
  },
  "contentSlideStyle": {
    "bgColor": "#RRGGBB — cor de fundo dos slides de conteúdo, geralmente diferente da capa",
    "accentColor": "#RRGGBB — cor de destaque nos slides intermediários",
    "titleAlign": "left ou center",
    "description": "1-2 frases sobre os slides internos (ex: 'fundo claro com texto escuro e linha de destaque colorida')"
  },
  "ctaSlideStyle": {
    "bgColor": "#RRGGBB — cor de fundo do slide final/CTA",
    "accentColor": "#RRGGBB — cor de destaque no CTA",
    "description": "1 frase sobre o slide de fechamento (ex: 'fundo sólido escuro com CTA e handle do perfil')"
  },
  "brandKeywords": ["palavras-chave que definem o branding deste perfil"],
  "styleSummary": "3-4 frases descrevendo o estilo visual EXATO observado nas imagens, mencionando cores reais, padrões e sensação geral",
  "toneDescription": "1-2 frases sobre o tom de comunicação e personalidade da marca",
  "designTokens": {
    "--color-primary": "#RRGGBB",
    "--color-secondary": "#RRGGBB",
    "--color-bg": "#RRGGBB",
    "--color-text": "#RRGGBB",
    "--color-accent": "#RRGGBB",
    "--font-primary": "font-family CSS",
    "--font-secondary": "font-family CSS",
    "--border-radius": "valor CSS (ex: '8px' ou '0px')",
    "--spacing-unit": "valor CSS (ex: '16px')"
  }
}`;

  // ── Early return when no images available ──────────────────────────────────
  // Do NOT ask Claude to invent colors when there's no visual data — it generates
  // plausible-but-wrong palettes based on the niche name, misleading the user.
  if (imageBlocks.length === 0) {
    console.log(`[StyleAgent] @${cleanUsername}: no images — returning upload-required result`);
    return {
      accentColor: "#8b5cf6",
      bgColor: "#f8f9fa",
      primaryColor: "#6d28d9",
      secondaryColor: "#a78bfa",
      textColor: "#1a1a1a",
      fontFamily: "system-ui, sans-serif",
      secondaryFont: "sans-serif",
      fontWeight: "regular",
      titleAlign: "left",
      titleSize: 1,
      profileName: profile.name ?? cleanUsername,
      profileHandle: `@${cleanUsername}`,
      profileImageUrl: profilePictureDataUrl ?? profile.profilePictureUrl ?? null,
      rawPostImageUrls: [],
      styleSummary: `Não foi possível acessar as imagens do perfil @${cleanUsername}. O servidor não consegue baixar posts de perfis externos (Instagram bloqueia IPs de servidores). Para analisar as cores reais deste perfil, vá em "Nova análise", digite @${cleanUsername} e use a seção "Capturas de tela do perfil" para fazer upload de 4 a 8 prints do feed antes de clicar em Analisar.`,
      toneDescription: "—",
      niche: profile.niche ?? "Não identificado",
      targetAudience: "—",
      objective: "—",
      layoutPattern: "—",
      editingStyle: "—",
      recurringElements: "—",
      postStructure: "—",
      visualEffects: "—",
      copyType: "—",
      captionStructure: "—",
      ctaExamples: [],
      language: "—",
      frequentEmojis: "",
      brandKeywords: [],
      designTokens: {
        "--color-primary": "#6d28d9",
        "--color-secondary": "#a78bfa",
        "--color-bg": "#f8f9fa",
        "--color-text": "#1a1a1a",
        "--color-accent": "#8b5cf6",
        "--font-primary": "system-ui, sans-serif",
        "--font-secondary": "system-ui, sans-serif",
        "--border-radius": "8px",
        "--spacing-unit": "16px",
      },
    };
  }

  const userContent: AnthropicContent[] = [
    {
      type: "text",
      text: [
        `Analise as ${imageBlocks.length} imagens do perfil ${profileDesc}.`,
        uploadedBlocks.length > 0
          ? `As primeiras ${uploadedBlocks.length} imagem(ns) são capturas de tela enviadas pelo usuário com os posts reais do perfil — estas são a REFERÊNCIA PRINCIPAL.`
          : `A PRIMEIRA imagem é a foto de perfil (avatar), que geralmente contém o LOGO com as cores de marca mais representativas.`,
        `\nFOCO PRINCIPAL: identificar as CORES DE MARCA REAIS do perfil.\n\n1. ${uploadedBlocks.length > 0 ? "Examine as capturas de tela enviadas — o logo e os elementos gráficos nelas são a referência de cor mais confiável" : "Comece pela foto de perfil — o logo nela é a referência de cor mais confiável"}\n2. Procure em TODOS os posts por elementos gráficos repetidos: logo, fundo de slide, cor de texto, ícone, moldura\n3. Extraia a cor HEX EXATA desses elementos consistentes — essas são as brand colors\n4. Priorize carrosseis e posts com design gráfico (fundo colorido, texto grande) sobre fotos naturais\n5. IGNORE: cor do céu, vegetação, pele, paredes de fundo de fotos\n6. Identifique nicho, público-alvo, padrões de layout e estratégia de conteúdo`,
      ].join(" "),
    },
    ...imageBlocks,
    {
      type: "text",
      text: `Com base EXCLUSIVAMENTE nas imagens analisadas acima, retorne o seguinte JSON completo:\n${jsonSchema}`,
    },
  ];

  const fallback: InstagramStyleResult = {
    accentColor: "#29d9ff",
    bgColor: "#0d1117",
    primaryColor: "#29d9ff",
    secondaryColor: "#1a8aff",
    textColor: "#ffffff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    secondaryFont: "sans-serif",
    fontWeight: "medium",
    titleAlign: "left",
    titleSize: 1,
    profileName: profile.name ?? cleanUsername,
    profileHandle: `@${cleanUsername}`,
    profileImageUrl: profilePictureDataUrl ?? profile.profilePictureUrl,
    rawPostImageUrls: rawPostDataUrls,
    styleSummary: "Não foi possível carregar as imagens do perfil para análise.",
    toneDescription: "Comunicação profissional.",
    niche: "Não identificado",
    targetAudience: "Não identificado",
    objective: "Não identificado",
    layoutPattern: "Grade uniforme",
    editingStyle: "Não identificado",
    recurringElements: "Não identificado",
    postStructure: "Não identificado",
    visualEffects: "Não identificado",
    copyType: "Não identificado",
    captionStructure: "Gancho + desenvolvimento + CTA",
    ctaExamples: [],
    language: "Português brasileiro",
    frequentEmojis: "",
    brandKeywords: [],
    designTokens: {
      "--color-primary": "#29d9ff",
      "--color-secondary": "#1a8aff",
      "--color-bg": "#0d1117",
      "--color-text": "#ffffff",
      "--color-accent": "#29d9ff",
      "--font-primary": "system-ui, -apple-system, sans-serif",
      "--font-secondary": "system-ui, -apple-system, sans-serif",
      "--border-radius": "8px",
      "--spacing-unit": "16px",
    },
  };

  const raw = await invokeAnthropicLLM({
    system: systemPrompt,
    userContent,
    maxTokens: 2000,
  });

  const parsed = parseClaudeJsonResponse<Partial<InstagramStyleResult>>(raw, {});

  return {
    ...fallback,
    ...parsed,
    profileHandle: `@${String(parsed.profileHandle ?? cleanUsername).replace(/^@/, "")}`,
    profileImageUrl: profilePictureDataUrl ?? profile.profilePictureUrl ?? parsed.profileImageUrl,
    rawPostImageUrls: rawPostDataUrls,
  };
}
