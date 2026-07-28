import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ENV } from "./env";
import { storagePut } from "../storage";
import type { StorySlide } from "./storyContentSchema";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// ─── Types ───────────────────────────────────────────────────────────────────

type ArtDirectorResult = {
  prompt: string;
  safe_zone_note: string;
  suggested_headline: string;
  suggested_cta: string;
  overlay_color: string;
};

export type StoryImageResult = {
  url: string;
  overlayColor?: string;
  suggestedHeadline?: string;
  suggestedCta?: string;
  safeZoneNote?: string;
};

// ─── Art Director system prompt ───────────────────────────────────────────────

const ART_DIRECTOR_SYSTEM = `Você é um diretor de arte especializado em Instagram Stories.

Sua função: converter um briefing em um ÚNICO prompt em inglês, otimizado para DALL-E 3, que gere uma imagem de FUNDO para um Story vertical 9:16.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com JSON válido. Sem markdown, sem crases, sem preâmbulo.
2. O prompt deve ser em INGLÊS, de 60 a 120 palavras.
3. NUNCA inclua texto, palavras, letras, números, logos ou tipografia na imagem. Sempre termine o prompt com: "no text, no letters, no words, no logos, no watermarks."
4. Composição vertical obrigatória. Descreva explicitamente:
   - Zona superior (0-25%): respiro visual, sem elemento crítico (a UI do Instagram cobre essa área)
   - Zona central (25-75%): foco visual principal
   - Zona inferior (75-100%): área limpa para CTA e sticker de link
5. Especifique sempre: estilo visual, paleta de cores, tipo de iluminação, ângulo de câmera e profundidade de campo.
6. Se o briefing indicar paleta de marca, respeite as cores informadas.
7. Evite composições centralizadas e simétricas demais — Story pede dinamismo e diagonais.

FORMATO DE SAÍDA:
{
  "prompt": "prompt em inglês para o DALL-E",
  "safe_zone_note": "onde a imagem está limpa para receber texto",
  "suggested_headline": "headline em português, máx 6 palavras",
  "suggested_cta": "CTA em português, máx 4 palavras",
  "overlay_color": "#RRGGBB — cor de texto com melhor contraste sobre a imagem"
}`;

// ─── Per-type style hints (used in fallback briefing) ────────────────────────

const TYPE_STYLE: Record<string, string> = {
  poll:               "bold graphic split composition, vivid contrasting colors, high-contrast energetic",
  quiz:               "playful colorful geometry, bright energetic palette, quiz-show atmosphere, dynamic",
  countdown:          "dramatic cinematic lighting, epic moody atmosphere, strong urgency, dark dramatic",
  question_box:       "warm inviting lifestyle, soft pastel tones, approachable cozy natural environment",
  behind_scenes:      "candid authentic mood, golden hour warm lighting, documentary real-life moment",
  post_reinforcement: "modern professional brand aesthetic, clean bold design, sleek striking",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSlideContext(slide: StorySlide): string {
  const parts = [`Headline: "${slide.headline}"`];
  switch (slide.type) {
    case "poll":
      parts.push(`Poll question: "${slide.question}" — options: "${slide.option_a}" vs "${slide.option_b}"`);
      break;
    case "quiz":
      parts.push(`Quiz: "${slide.question}"`);
      if (slide.options?.length) parts.push(`Options: ${slide.options.join(", ")}`);
      break;
    case "countdown":
      parts.push(`Message: "${slide.body}". Event: "${slide.target_label}"`);
      break;
    case "behind_scenes":
      parts.push(`Content: "${slide.caption}". Tone: ${slide.tone}`);
      break;
    case "post_reinforcement":
      parts.push(`Angle: "${slide.angle}"`);
      break;
  }
  return parts.join(". ");
}

// Persist buffer: S3 → /uploads/ → base64 data URI (always succeeds)
async function persistBuffer(buffer: Buffer, ext: string, contentType: string): Promise<string> {
  const filename = `story-${randomUUID()}.${ext}`;
  try {
    const result = await storagePut(`stories/${filename}`, buffer, contentType);
    console.log("[StoryImage] Stored to cloud:", result.url.slice(0, 80));
    return result.url;
  } catch { /* fall through */ }
  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    console.log("[StoryImage] Stored locally:", `/uploads/${filename}`);
    return `/uploads/${filename}`;
  } catch { /* fall through */ }
  // Last resort: embedded data URI (no server needed)
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

// ─── Step 1: Art Director — generates optimized DALL-E prompt + metadata ──────

async function callArtDirector(
  slide: StorySlide,
  topic?: string,
  brandColors?: string,
): Promise<ArtDirectorResult | null> {
  if (!ENV.anthropicApiKey) {
    console.log("[StoryImage] No ANTHROPIC_API_KEY — skipping art director, using fallback prompt");
    return null;
  }

  const slideContext = buildSlideContext(slide);
  const typeHint = TYPE_STYLE[slide.type] ?? "vivid Instagram Story background";

  const briefing = [
    `Tipo de story: ${slide.type}`,
    topic ? `Tema principal: ${topic}` : null,
    `Contexto do slide: ${slideContext}`,
    `Cena visual sugerida: ${slide.visual_prompt}`,
    `Estilo desejado: ${typeHint}`,
    brandColors ? `Paleta de marca: ${brandColors}` : null,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ENV.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 450,
        system: ART_DIRECTOR_SYSTEM,
        messages: [{ role: "user", content: briefing }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn("[StoryImage] Art director HTTP error:", res.status);
      return null;
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = (data.content?.[0]?.text ?? "").trim();
    // Strip accidental markdown fences
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(clean) as ArtDirectorResult;
    console.log("[StoryImage] Art director done. Prompt:", parsed.prompt.slice(0, 70));
    return parsed;
  } catch (err) {
    console.warn("[StoryImage] Art director failed:", err);
    return null;
  }
}

// ─── Step 2: DALL-E 3 → Step 3: Sharp resize → Step 4: Persist ──────────────

async function generateAndResize(dallePrompt: string): Promise<Buffer | null> {
  console.log("[StoryImage] Calling DALL-E 3...");

  const resp = await fetch(`${ENV.openaiApiBaseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: dallePrompt,
      size: "1024x1792",
      quality: "hd",
      style: "vivid",
      response_format: "b64_json",
      n: 1,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    console.warn(`[StoryImage] DALL-E 3 error (${resp.status}): ${errText.slice(0, 300)}`);
    return null;
  }

  const result = (await resp.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    console.warn("[StoryImage] No b64_json in DALL-E 3 response");
    return null;
  }

  // Resize with sharp to exact Instagram Story resolution (1080×1920)
  const pngBuffer = await sharp(Buffer.from(b64, "base64"))
    .resize(1080, 1920, { fit: "cover", position: "center" })
    .png({ quality: 95 })
    .toBuffer();

  console.log("[StoryImage] Resized to 1080×1920 via sharp");
  return pngBuffer;
}

// ─── Main export: generate one story slide image ─────────────────────────────

export async function generateStoryImage(
  slide: StorySlide,
  topic?: string,
  brandColors?: string,
): Promise<StoryImageResult | null> {
  if (!ENV.openaiApiKey) {
    console.warn("[StoryImage] OPENAI_API_KEY not configured — skipping");
    return null;
  }

  // Step 1: Art director → optimized DALL-E prompt
  const artResult = await callArtDirector(slide, topic, brandColors);

  let dallePrompt: string;
  if (artResult?.prompt) {
    dallePrompt = artResult.prompt;
  } else {
    // Fallback: build prompt directly without art director
    const typeHint = TYPE_STYLE[slide.type] ?? "vivid Instagram Story background";
    dallePrompt = [
      "Professional Instagram Story background image, vertical 9:16 portrait format.",
      topic ? `Main topic: ${topic}.` : null,
      `Visual scene: ${slide.visual_prompt}.`,
      buildSlideContext(slide),
      `Style: ${typeHint}.`,
      "no text, no letters, no words, no logos, no watermarks.",
    ].filter(Boolean).join(" ");
  }

  // Steps 2–4: DALL-E 3 → sharp → persist
  try {
    const pngBuffer = await generateAndResize(dallePrompt);
    if (!pngBuffer) return null;

    const url = await persistBuffer(pngBuffer, "png", "image/png");
    console.log(`[StoryImage] Complete for type=${slide.type}`);

    return {
      url,
      overlayColor: artResult?.overlay_color,
      suggestedHeadline: artResult?.suggested_headline,
      suggestedCta: artResult?.suggested_cta,
      safeZoneNote: artResult?.safe_zone_note,
    };
  } catch (err) {
    console.error(`[StoryImage] Pipeline failed for type=${slide.type}:`, err);
    return null;
  }
}

// Generate images for all slides in parallel
export async function generateSlideImages(
  slides: StorySlide[],
  topic?: string,
  brandColors?: string,
): Promise<Array<StoryImageResult | null>> {
  return Promise.all(slides.map((s) => generateStoryImage(s, topic, brandColors)));
}
