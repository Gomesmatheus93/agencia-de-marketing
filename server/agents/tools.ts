import type Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";
import { mkdtemp, readFile as fsReadFile, rm, writeFile as fsWriteFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import * as db from "../db";
import { ENV } from "../_core/env";
import sharp from "sharp";
import { persistGeneratedImage } from "../_core/imageGeneration";
import { DESIGN_FORMATS, DesignError, renderDesign, type DesignFormat } from "./design/render";
import { searchStockPhotos } from "./design/photos";
import * as store from "./store";

type Tool = Anthropic.Beta.Messages.BetaTool;
type ToolResultContent = Anthropic.Beta.Messages.BetaToolResultBlockParam["content"];

export const SKILLS_DIR = path.resolve(process.cwd(), "server/agents/skills");

const MAX_OUTPUT_CHARS = 30_000;
const SCRIPT_TIMEOUT_MS = 20_000;

// ─── Definições (ordem fixa: faz parte do prefixo em cache) ───────────────────

export const AGENT_TOOLS: Tool[] = [
  {
    name: "load_skill",
    description:
      "Carrega o SKILL.md de outra skill (ex.: ig-human, ig-caption, ig-reel, alle-design) para você segui-la. Use quando a sua skill mandar passar o texto por outra (\"run /ig-human\", \"hand it to /ig-plan\") e, antes de qualquer arte, carregue alle-design.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Nome da skill, ex.: ig-human" } },
      required: ["name"],
    },
  },
  {
    name: "list_files",
    description: "Lista os arquivos da memória compartilhada entre os agentes (voice.md, swipe.md, log.md, plan.md…).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_file",
    description:
      "Lê um arquivo da memória compartilhada (ex.: voice.md, plan.md) ou um arquivo de referência das skills, somente leitura, com o prefixo skills/ (ex.: skills/ig-reel/hooks.json, skills/ig-profile/rubric.json, skills/voice.template.md).",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Cria ou substitui um arquivo da memória compartilhada (ex.: voice.md, swipe.md, log.md, plan.md). Os outros agentes leem esses arquivos. Para acrescentar a um log, leia antes e grave o conteúdo inteiro.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Nome do arquivo, ex.: plan.md" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_script",
    description: [
      "Roda uma das ferramentas Python das skills sobre um texto e devolve a saída.",
      "caption: analisa uma legenda (janela de 125 caracteres, hashtags, CTA, links, emojis); aceita keywords.",
      "hookscore: pontua ganchos, um por linha.",
      "beats: cronometra um roteiro de Reel; aceita target_seconds e wpm.",
      "humanize: limpa o texto (traços, aspas, caracteres invisíveis, clichês) e lista o que mudou.",
      "detect: dá a nota de \"texto humano\"; com compare_with mostra antes e depois.",
      "swipe: ranqueia reels coletados (TSV com cabeçalho: account, followers, median, views, hook).",
    ].join(" "),
    input_schema: {
      type: "object",
      properties: {
        script: { type: "string", enum: ["caption", "hookscore", "beats", "humanize", "detect", "swipe"] },
        input: { type: "string", description: "O texto a analisar (legenda, ganchos, roteiro, rascunho ou TSV)." },
        compare_with: { type: "string", description: "detect: a versão depois, para comparar com input." },
        keywords: { type: "string", description: "caption: termos de busca separados por vírgula." },
        target_seconds: { type: "number", description: "beats: duração alvo em segundos." },
        wpm: { type: "number", description: "beats: palavras por minuto (padrão 165)." },
        language: {
          type: "string",
          enum: ["pt", "en"],
          description: "humanize/detect: léxico de clichês em português (padrão) ou o original em inglês.",
        },
      },
      required: ["script", "input"],
    },
  },
  {
    name: "get_brand_identity",
    description: "Lê a identidade da marca (Alle Energia) cadastrada na plataforma: nome, slogan, público, tom de voz, cores, @ do Instagram, CTA padrão.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_instagram_account",
    description: "Lê o perfil do Instagram conectado: @, nome, bio, site, seguidores, seguindo e número de posts.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_instagram_posts",
    description:
      "Lê os posts publicados no Instagram conectado, do mais recente para o mais antigo: legenda, formato, data, link, curtidas, comentários e a URL da imagem/capa.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Quantos posts (1 a 100, padrão 30)." } },
    },
  },
  {
    name: "get_post_insights",
    description:
      "Lê as métricas de um post (alcance, salvamentos, compartilhamentos, visualizações, interações). Depende da permissão de insights do app da Meta; se não houver, devolve o erro.",
    input_schema: {
      type: "object",
      properties: { media_id: { type: "string" } },
      required: ["media_id"],
    },
  },
  {
    name: "render_design",
    description:
      "Transforma uma arte desenhada em SVG (post, slide de carrossel, stories) em PNG, salva na galeria da plataforma e devolve a imagem para você conferir. Siga a skill alle-design. Imagens: href=\"alle:logo\" (e alle:logo-branco, alle:raio, alle:raio-branco, alle:raio-mono) para a marca e URLs https de search_photos para fotos.",
    input_schema: {
      type: "object",
      properties: {
        format: { type: "string", enum: Object.keys(DESIGN_FORMATS) },
        title: { type: "string", description: "Nome curto da peça, ex.: \"Carrossel bandeira tarifária — slide 1/7\"." },
        svg: { type: "string", description: "O SVG completo, com o viewBox do formato." },
      },
      required: ["format", "title", "svg"],
    },
  },
  {
    name: "search_photos",
    description: "Busca fotos gratuitas (Pexels, Unsplash, Pixabay) para usar nas artes. Pesquise em português ou inglês, com termos concretos (ex.: \"telhado com painel solar\", \"família na sala\").",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        orientation: { type: "string", enum: ["portrait", "landscape", "square"] },
      },
      required: ["query"],
    },
  },
  {
    name: "scan_public_instagram",
    description:
      "Plano B quando o Instagram da marca não está conectado: tenta ver as imagens recentes de um perfil público (sem legendas nem métricas). Pode falhar, porque o Instagram bloqueia leituras de fora; nesse caso, diga que é preciso conectar o Instagram.",
    input_schema: {
      type: "object",
      properties: { username: { type: "string", description: "Ex.: alleenergia" } },
      required: ["username"],
    },
  },
  {
    name: "view_image",
    description: "Abre uma imagem por URL (ex.: a capa de um post do Instagram) para você ver o visual.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
];

// ─── Execução ─────────────────────────────────────────────────────────────────

class ToolError extends Error {}

const FILE_PATH_RE = /^[a-z0-9][a-z0-9_\-./]{0,99}\.(md|txt|tsv|json)$/i;

/** Aceita os caminhos das skills originais (~/.claude/instagram/voice.md). */
function workspacePath(raw: string): string {
  const p = raw.trim().replace(/^~\/\.claude\/instagram\//, "").replace(/^\.?\//, "");
  if (!FILE_PATH_RE.test(p) || p.includes("..")) throw new ToolError(`Caminho inválido: ${raw}`);
  return p;
}

function skillsPath(raw: string): string {
  const resolved = path.resolve(SKILLS_DIR, raw.replace(/^skills\//, ""));
  const rel = path.relative(SKILLS_DIR, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel) || !/\.(md|json)$/.test(resolved)) {
    throw new ToolError(`Arquivo de skill inválido: ${raw}`);
  }
  return resolved;
}

export async function loadSkillText(name: string): Promise<string> {
  if (!/^(ig|alle)-[a-z]+$/.test(name)) throw new ToolError(`Skill desconhecida: ${name}`);
  try {
    return await fsReadFile(path.join(SKILLS_DIR, name, "SKILL.md"), "utf8");
  } catch {
    throw new ToolError(`Skill desconhecida: ${name}`);
  }
}

function truncate(text: string): string {
  return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n…[saída cortada]` : text;
}

const SCRIPTS: Record<string, string> = {
  caption: "ig-caption/caption.py",
  hookscore: "ig-reel/hookscore.py",
  beats: "ig-reel/beats.py",
  humanize: "ig-human/humanize.py",
  detect: "ig-human/detect.py",
  swipe: "ig-viral/swipe.py",
};

const RunScriptInput = z.object({
  script: z.enum(["caption", "hookscore", "beats", "humanize", "detect", "swipe"]),
  input: z.string().min(1),
  compare_with: z.string().optional(),
  keywords: z.string().optional(),
  target_seconds: z.number().positive().max(600).optional(),
  wpm: z.number().positive().max(400).optional(),
  language: z.enum(["pt", "en"]).default("pt"),
});

async function runScript(raw: unknown): Promise<string> {
  const args = RunScriptInput.parse(raw);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "agent-script-"));
  try {
    const inputFile = path.join(tmp, "input.txt");
    await fsWriteFile(inputFile, args.input, "utf8");
    const argv = ["-I", "-B", path.join(SKILLS_DIR, SCRIPTS[args.script]), inputFile];
    if (args.script === "detect" && args.compare_with) {
      const after = path.join(tmp, "after.txt");
      await fsWriteFile(after, args.compare_with, "utf8");
      argv.push(after);
    }
    if (args.script === "caption" && args.keywords) argv.push("--keywords", args.keywords);
    if (args.script === "beats" && args.target_seconds) argv.push("--target", String(args.target_seconds));
    if (args.script === "beats" && args.wpm) argv.push("--wpm", String(args.wpm));
    if (args.script === "humanize") argv.push("--report");
    if ((args.script === "humanize" || args.script === "detect") && args.language === "pt") {
      argv.push("--lexicon", path.join(SKILLS_DIR, "ig-human/slop.pt.json"));
    }

    const { stdout, stderr, code } = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
      (resolve, reject) => {
        const child = spawn("python3", argv, { cwd: tmp, timeout: SCRIPT_TIMEOUT_MS, env: { PATH: process.env.PATH ?? "" } });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("error", reject);
        child.on("close", (c) => resolve({ stdout: out, stderr: err, code: c }));
      }
    );
    const parts = [stdout.trim()];
    if (stderr.trim()) parts.push(args.script === "humanize" ? `RELATÓRIO\n${stderr.trim()}` : `STDERR\n${stderr.trim()}`);
    // Código de saída diferente de 0 só indica veredito "não aprovado" nesses scripts.
    parts.push(`(exit ${code})`);
    return truncate(parts.filter(Boolean).join("\n\n"));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function instagramConfig(userId: number) {
  const connection = await db.getInstagramConnection(userId);
  if (!connection?.accessToken || !connection.instagramAccountId) {
    throw new ToolError(
      "O Instagram da marca não está conectado na plataforma (Configurações → Instagram). Peça ao usuário para conectar ou colar os dados."
    );
  }
  const base = connection.tokenSource === "instagram"
    ? "https://graph.instagram.com"
    : (ENV.metaGraphApiBaseUrl || "https://graph.facebook.com").replace(/\/+$/, "");
  const version = (ENV.metaGraphApiVersion || "v25.0").replace(/^\/+/, "");
  return { base: `${base}/${version}`, igId: connection.instagramAccountId, token: connection.accessToken };
}

async function graph<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || data.error) throw new ToolError(`API da Meta: ${data.error?.message ?? res.status}`);
  return data;
}

type MediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
  media_url?: string;
  thumbnail_url?: string;
};

async function getInstagramPosts(userId: number, limit: number) {
  const { base, igId, token } = await instagramConfig(userId);
  const fields = "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,media_url,thumbnail_url";
  let url: string | undefined =
    `${base}/${igId}/media?${new URLSearchParams({ fields, limit: String(Math.min(limit, 50)), access_token: token })}`;
  const posts: MediaItem[] = [];
  while (url && posts.length < limit) {
    const page: { data?: MediaItem[]; paging?: { next?: string } } = await graph(url);
    posts.push(...(page.data ?? []));
    url = page.paging?.next;
  }
  return posts.slice(0, limit).map((p) => ({
    id: p.id,
    data: p.timestamp,
    formato: p.media_product_type === "REELS" ? "REEL" : p.media_type,
    curtidas: p.like_count,
    comentarios: p.comments_count,
    link: p.permalink,
    imagem: p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url,
    legenda: p.caption ?? "",
  }));
}

async function getPostInsights(userId: number, mediaId: string) {
  if (!/^\d+$/.test(mediaId)) throw new ToolError("media_id inválido");
  const { base, token } = await instagramConfig(userId);
  const metrics = "reach,saved,shares,views,total_interactions";
  const data = await graph<{ data?: Array<{ name: string; values?: Array<{ value: number }> }> }>(
    `${base}/${mediaId}/insights?${new URLSearchParams({ metric: metrics, access_token: token })}`
  );
  return Object.fromEntries((data.data ?? []).map((m) => [m.name, m.values?.[0]?.value ?? null]));
}

async function viewImage(url: string): Promise<ToolResultContent> {
  if (!/^https:\/\//.test(url)) throw new ToolError("Só URLs https.");
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const type = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!res.ok || !/^image\/(jpeg|png|gif|webp)$/.test(type)) throw new ToolError(`Não foi possível abrir a imagem (${res.status} ${type}).`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 5_000_000) throw new ToolError("Imagem grande demais (máx. 5 MB).");
  return [{
    type: "image",
    source: { type: "base64", media_type: type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: bytes.toString("base64") },
  }];
}

/** Executa uma chamada de ferramenta e devolve o conteúdo do tool_result. */
export async function executeTool(
  userId: number,
  name: string,
  input: unknown
): Promise<{ content: ToolResultContent; isError: boolean }> {
  const i = (input ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "load_skill":
        return ok(await loadSkillText(String(i.name ?? "")));
      case "list_files": {
        const files = await store.listFiles(userId);
        return ok(files.length ? files.map((f) => `${f.path}  (${f.size} caracteres)`).join("\n") : "Nenhum arquivo ainda.");
      }
      case "read_file": {
        const raw = String(i.path ?? "");
        if (raw.startsWith("skills/")) return ok(truncate(await fsReadFile(skillsPath(raw), "utf8")));
        const content = await store.readFile(userId, workspacePath(raw));
        return content === null ? fail(`Arquivo ${raw} ainda não existe.`) : ok(truncate(content));
      }
      case "write_file": {
        const p = workspacePath(String(i.path ?? ""));
        const content = String(i.content ?? "");
        if (content.length > 200_000) throw new ToolError("Conteúdo grande demais (máx. 200 mil caracteres).");
        await store.writeFile(userId, p, content);
        return ok(`Gravado: ${p} (${content.length} caracteres).`);
      }
      case "run_script":
        return ok(await runScript(input));
      case "get_brand_identity": {
        const brand = await db.getBrandKit(userId);
        if (!brand) return fail("Nenhuma identidade de marca cadastrada.");
        const { id: _id, userId: _u, createdAt: _c, updatedAt: _up, ...fields } = brand;
        return ok(JSON.stringify(fields, null, 2));
      }
      case "get_instagram_account": {
        const { base, igId, token } = await instagramConfig(userId);
        const fields = "username,name,biography,website,followers_count,follows_count,media_count";
        return ok(JSON.stringify(await graph(`${base}/${igId}?${new URLSearchParams({ fields, access_token: token })}`), null, 2));
      }
      case "get_instagram_posts": {
        const limit = Math.max(1, Math.min(100, Number(i.limit ?? 30) || 30));
        return ok(truncate(JSON.stringify(await getInstagramPosts(userId, limit), null, 2)));
      }
      case "get_post_insights":
        return ok(JSON.stringify(await getPostInsights(userId, String(i.media_id ?? "")), null, 2));
      case "render_design":
        return await renderDesignTool(userId, input);
      case "search_photos": {
        const query = String(i.query ?? "").trim();
        if (!query) throw new ToolError("Informe o que buscar.");
        const orientation = (["portrait", "landscape", "square"] as const).find((o) => o === i.orientation) ?? "portrait";
        const photos = await searchStockPhotos(query, orientation);
        if (!photos.length) return fail("Nenhuma foto encontrada. Tente outros termos.");
        return ok(JSON.stringify(photos.map(({ url, thumb, width, height, author, source }) => ({ url, preview: thumb, tamanho: `${width}x${height}`, autor: author, fonte: source })), null, 2));
      }
      case "scan_public_instagram":
        return await scanPublicInstagram(String(i.username ?? ""));
      case "view_image":
        return { content: await viewImage(String(i.url ?? "")), isError: false };
      default:
        return fail(`Ferramenta desconhecida: ${name}`);
    }
  } catch (error) {
    if (error instanceof ToolError) return fail(error.message);
    if (error instanceof z.ZodError) return fail(`Parâmetros inválidos: ${error.issues.map((x) => x.message).join("; ")}`);
    console.error(`[agents] ferramenta ${name} falhou:`, error);
    return fail(`Falha ao executar ${name}: ${(error as Error).message}`);
  }
}

async function scanPublicInstagram(username: string): Promise<{ content: ToolResultContent; isError: boolean }> {
  if (!/^@?[A-Za-z0-9._]{1,30}$/.test(username)) throw new ToolError("Usuário do Instagram inválido.");
  const { fetchPublicInstagramSnapshot } = await import("../_core/instagramStyleAgent");
  const snap = await fetchPublicInstagramSnapshot(username, 9);
  const images = snap.images.filter((img) => img.dataUrl);
  if (!images.length) {
    return fail(`Não consegui ver o perfil público @${snap.username}: o Instagram bloqueou a leitura de fora. Para analisar o feed, o Instagram da marca precisa estar conectado na plataforma.`);
  }
  const blocks = await Promise.all(images.map(async (img) => {
    const b64 = img.dataUrl!.split(",")[1];
    const small = await sharp(Buffer.from(b64, "base64")).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    return { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: small.toString("base64") } };
  }));
  return {
    isError: false,
    content: [{ type: "text", text: `Perfil público @${snap.username}: ${images.length} imagens recentes (sem legendas nem métricas), da mais nova para a mais antiga.` }, ...blocks],
  };
}

const RenderDesignInput = z.object({
  format: z.enum(Object.keys(DESIGN_FORMATS) as [DesignFormat, ...DesignFormat[]]),
  title: z.string().trim().min(1).max(200),
  svg: z.string().min(50).max(400_000),
});

async function renderDesignTool(userId: number, raw: unknown): Promise<{ content: ToolResultContent; isError: boolean }> {
  const args = RenderDesignInput.parse(raw);
  let png: Buffer;
  try {
    png = await renderDesign(args.svg, args.format);
  } catch (error) {
    if (error instanceof DesignError) return fail(error.message);
    throw error;
  }
  const { width, height } = DESIGN_FORMATS[args.format];
  const { url } = await persistGeneratedImage(png.toString("base64"), "png");
  await db.saveImage(userId, args.title, url, undefined, width, height);
  // Prévia reduzida para o agente conferir sem gastar tokens com 1080 px.
  const preview = await sharp(png).resize({ width: 540 }).jpeg({ quality: 82 }).toBuffer();
  return {
    isError: false,
    content: [
      { type: "text", text: `Arte salva na galeria: "${args.title}"\nARTE_URL=${url}\nConfira a imagem abaixo antes de entregar.` },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: preview.toString("base64") } },
    ],
  };
}

function ok(text: string) {
  return { content: text, isError: false };
}
function fail(text: string) {
  return { content: text, isError: true };
}
