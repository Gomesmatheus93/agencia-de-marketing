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
      `${base}/${instagramAccountId}/media?fields=media_url,thumbnail_url,media_type&limit=12&access_token=${accessToken}`,
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
    .slice(0, 12);

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

    // Bio from OG description
    const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1]
      ?.replace(/&amp;/g, "&")
      ?.replace(/&#39;/g, "'")
      ?.replace(/&quot;/g, '"') || "";

    // Try to find post image URLs embedded in the page JSON
    const postImageUrls: string[] = [];
    const cdnPattern = /https:\/\/[^"']+\.cdninstagram\.com\/[^"']+\.(?:jpg|jpeg|png|webp)/gi;
    const allCdnUrls = Array.from(html.matchAll(cdnPattern)).map((m) => m[0]);
    const seen = new Set<string>();
    for (const url of allCdnUrls) {
      if (/[_/]s\d{2,3}x\d{2,3}[_/]/.test(url)) continue;
      if (seen.has(url) || url === ogImage) continue;
      seen.add(url);
      postImageUrls.push(url);
      if (postImageUrls.length >= 9) break;
    }

    return {
      username,
      name: ogDesc ? `${name ?? username} — ${ogDesc.slice(0, 120)}` : name,
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
  const downloadResults = await Promise.allSettled(
    allImageUrls.slice(0, 10).map((url) => fetchImageAsBase64(url))
  );

  // Persist the profile picture as a data URL so it never expires
  let profilePictureDataUrl: string | undefined;
  const picIsFirst = profile.profilePictureUrl && allImageUrls[0] === profile.profilePictureUrl;
  if (picIsFirst && downloadResults[0]?.status === "fulfilled" && downloadResults[0].value) {
    const block = downloadResults[0].value;
    if (block.source.type === "base64") {
      profilePictureDataUrl = `data:${block.source.media_type};base64,${block.source.data}`;
    }
  }

  for (const r of downloadResults) {
    if (r.status === "fulfilled" && r.value) imageBlocks.push(r.value);
  }

  console.log(`[InstagramStyleAgent] Sending ${imageBlocks.length} base64 images to Claude for @${cleanUsername}`);

  const profileDesc = profile.name
    ? `@${cleanUsername} (${profile.name})`
    : `@${cleanUsername}`;

  const systemPrompt = `Você é um agente especialista em análise e clonagem estrutural de perfis do Instagram.

Seu objetivo é analisar completamente o perfil a partir das imagens enviadas e recriar toda a identidade visual e estratégica automaticamente — sem que o usuário precise configurar nada manualmente.

# COMPORTAMENTO OBRIGATÓRIO

## ANÁLISE VISUAL PROFUNDA
- Examine cada imagem pixel a pixel
- Extraia cores HEX EXATAS que aparecem nas imagens — nunca adivinhe baseado no nome da marca ou setor
- Identifique padrões visuais repetidos entre os posts
- Detecte estilos gráficos: sombras, bordas, glow, gradientes, filtros
- Classifique o estilo: moderno, minimalista, luxuoso, esportivo, colorido, etc.
- Analise a tipografia a partir da aparência visual
- Identifique o nicho, público-alvo e objetivo comercial a partir dos temas visuais

## EXTRAÇÃO DE IDENTIDADE
- Paleta completa: primária, secundária, fundo, texto, destaque
- Sistema tipográfico: fontes, pesos, hierarquia
- DNA visual: layouts, estrutura, elementos recorrentes
- Estratégia de conteúdo deduzida pelas imagens
- Tokens de design prontos para reutilização

## REGRAS CRÍTICAS
- Retorne APENAS JSON válido, sem texto antes ou depois
- Cores SEMPRE em formato #RRGGBB baseado nas imagens reais
- Se uma imagem não estiver disponível, indique no styleSummary
- Analise profundamente antes de responder — priorize fidelidade visual`;

  const jsonSchema = `{
  "accentColor": "#RRGGBB — cor de destaque mais usada (logo, títulos coloridos, ícones, botões)",
  "bgColor": "#RRGGBB — cor de fundo dominante dos posts",
  "primaryColor": "#RRGGBB — cor primária da identidade (pode ser igual ao accentColor)",
  "secondaryColor": "#RRGGBB — segunda cor mais usada",
  "textColor": "#RRGGBB — cor predominante dos textos",
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

  const userContent: AnthropicContent[] = imageBlocks.length > 0
    ? [
        {
          type: "text",
          text: `Analise as ${imageBlocks.length} imagens do perfil ${profileDesc}.\n\nFaça uma análise completa e profunda do DNA visual e estratégico deste perfil. Extraia as cores EXATAS em HEX que aparecem nas imagens. Identifique todos os padrões visuais, estilo de edição, estrutura de posts, nicho e estratégia de conteúdo.`,
        },
        ...imageBlocks,
        {
          type: "text",
          text: `Com base EXCLUSIVAMENTE nas imagens analisadas acima, retorne o seguinte JSON completo:\n${jsonSchema}`,
        },
      ]
    : [
        {
          type: "text",
          text: `Não foi possível carregar imagens do perfil ${profileDesc}. Indique no styleSummary que as imagens não estavam disponíveis. Sugira uma identidade visual genérica profissional:\n${jsonSchema}`,
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
  };
}
