import "dotenv/config";
import dns from "node:dns";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { startInstagramPostScheduler } from "./instagramPostScheduler";
import { startNewsDigestScheduler } from "./newsDigestScheduler";
import { startCommentAlertScheduler } from "./commentAlertScheduler";
import { startRadarScheduler } from "./radarScheduler";
import { startMetricsScheduler } from "./metricsScheduler";
import { autoGenerateFromNews } from "./newsAutoGenerator";
import { handleAggregatorWebhook, buildDigestTextMessage } from "./aggregatorWebhook";
import { serveStatic, setupVite } from "./vite";
import { validateRequiredEnv, ENV } from "./env";
import { sdk } from "./sdk";
import { storagePut, getMetaFetchableStorageUrl, getPresignedUploadUrl, buildAwsPublicUrl, ensureS3CorsConfigured } from "../storage";
import * as db from "../db";

// Comparação em tempo constante do X-Api-Key contra N8N_SECRET, evitando
// timing attacks que uma comparação `!==` simples permitiria.
function isValidN8nApiKey(apiKey: unknown): boolean {
  if (!ENV.n8nSecret || typeof apiKey !== "string") return false;
  const provided = Buffer.from(apiKey);
  const expected = Buffer.from(ENV.n8nSecret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function approvalHtmlPage(ok: boolean, action: string, reason?: string): string {
  const icon = ok ? "✅" : "❌";
  const title = ok ? `Post ${action}!` : "Não foi possível processar";
  const msg = ok
    ? action === "aprovado"
      ? "O post foi aprovado e será publicado na data agendada."
      : "O post foi rejeitado e não será publicado."
    : (reason ?? "Link inválido ou expirado.");
  const color = ok ? (action === "aprovado" ? "#166534" : "#991b1b") : "#92400e";
  const bg = ok ? (action === "aprovado" ? "#f0fdf4" : "#fff1f2") : "#fffbeb";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: ${bg}; padding: 1rem; }
    .card { background: white; border-radius: 16px; padding: 2.5rem 2rem;
      text-align: center; max-width: 400px; width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .icon { font-size: 3.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.4rem; font-weight: 700; color: ${color}; margin-bottom: .5rem; }
    p { font-size: .95rem; color: #6b7280; line-height: 1.5; }
    a { display: inline-block; margin-top: 1.5rem; font-size: .85rem;
      color: #7c3aed; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${msg}</p>
    <a href="/app">Abrir plataforma</a>
  </div>
</body>
</html>`;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Em containers/produção o host frequentemente anuncia rota IPv6 sem conectividade
// real de saída. O fetch nativo (undici) não faz fallback confiável para IPv4 nesse
// caso e lança "TypeError: fetch failed" em chamadas de API externas (ex: HeyGen).
// Forçar IPv4 primeiro elimina essa classe de falha intermitente.
dns.setDefaultResultOrder("ipv4first");

async function startServer() {
  validateRequiredEnv();

  const app = express();
  const server = createServer(app);
  // Trust the first proxy so req.protocol reflects x-forwarded-proto (needed for cookies and OAuth in production)
  app.set("trust proxy", 1);
  // Basic security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));
  // Serve uploaded images
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  // Blocks private/link-local IPs to prevent SSRF via proxy endpoints
  function isPrivateOrLinkLocalHost(hostname: string): boolean {
    if (hostname === "localhost" || hostname === "::1") return true;
    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
      if (a === 10) return true;
      if (a === 127) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true; // AWS metadata / link-local
      if (a === 0) return true;
    }
    return false;
  }

  // Image proxy — allows canvas to load cross-origin images without CORS taint
  app.get("/api/image-proxy", async (req, res) => {
    try { await sdk.authenticateRequest(req); } catch { res.status(401).send("Unauthorized"); return; }
    const url = typeof req.query.url === "string" ? req.query.url : "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      res.status(400).send("Invalid URL"); return;
    }
    try {
      const parsed = new URL(url);
      if (isPrivateOrLinkLocalHost(parsed.hostname)) {
        res.status(400).send("Forbidden URL"); return;
      }
      // For S3 private objects, generate a presigned URL so the proxy can fetch them
      const fetchUrl = await getMetaFetchableStorageUrl(url);
      const upstream = await fetch(fetchUrl, {
        headers: { "User-Agent": "KrythosLab/1.0 render-proxy", Accept: "image/*" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!upstream.ok) { res.status(502).send("Upstream error"); return; }
      const ct = upstream.headers.get("content-type") ?? "image/jpeg";
      if (!ct.startsWith("image/")) { res.status(400).send("Not an image"); return; }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.set("Content-Type", ct);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buf);
    } catch {
      res.status(502).send("Failed to fetch image");
    }
  });

  // Video proxy — streams S3 videos to the browser with CORS and range-request support.
  // Direct S3 links fail in browsers because S3 buckets don't have CORS headers for krythoslab.com.
  app.get("/api/video-proxy", async (req, res) => {
    try { await sdk.authenticateRequest(req); } catch { res.status(401).send("Unauthorized"); return; }
    const url = typeof req.query.url === "string" ? req.query.url : "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      res.status(400).send("Invalid URL"); return;
    }
    try {
      const parsed = new URL(url);
      if (isPrivateOrLinkLocalHost(parsed.hostname)) {
        res.status(400).send("Forbidden URL"); return;
      }
      const fetchUrl = await getMetaFetchableStorageUrl(url);
      const rangeHeader = req.headers.range;
      const upstream = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "KrythosLab/1.0 video-proxy",
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).send("Upstream error"); return;
      }
      const ct = upstream.headers.get("content-type") ?? "video/mp4";
      res.set("Content-Type", ct);
      res.set("Accept-Ranges", "bytes");
      res.set("Cache-Control", "public, max-age=86400");
      res.set("Access-Control-Allow-Origin", "*");
      const contentRange = upstream.headers.get("content-range");
      const contentLength = upstream.headers.get("content-length");
      if (contentRange) res.set("Content-Range", contentRange);
      if (contentLength) res.set("Content-Length", contentLength);
      res.status(upstream.status);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch {
      res.status(502).send("Failed to fetch video");
    }
  });

  // Media upload endpoint — receives raw binary, bypasses tRPC's 20MB JSON limit
  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-msvideo": "avi",
  };
  app.post(
    "/api/upload-media",
    express.raw({ type: ["image/*", "video/*"], limit: "250mb" }),
    async (req, res) => {
      try {
        const user = await sdk.authenticateRequest(req);
        const contentType = (req.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim();
        const ext = MIME_TO_EXT[contentType] ?? "bin";
        const key = `uploads/${user.id}/${randomUUID()}.${ext}`;
        const { url } = await storagePut(key, req.body as Buffer, contentType);
        res.json({ url });
      } catch (err) {
        const unauthorized = err instanceof Error && err.message.includes("Unauthorized");
        if (unauthorized) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        console.error("[upload-media] Erro:", err);
        res.status(500).json({ error: "Falha ao enviar o arquivo." });
      }
    }
  );

  // Presigned upload URL — returns S3 presigned PUT URL when AWS is configured
  // Clients use this to upload large files (especially videos) directly to S3,
  // bypassing the Express server and avoiding reverse-proxy body/timeout limits.
  app.post("/api/request-presigned-upload", express.json(), async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const contentType = (typeof req.body?.contentType === "string" ? req.body.contentType : "application/octet-stream").split(";")[0].trim();
      const MIME_TO_EXT: Record<string, string> = {
        "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
        "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-msvideo": "avi",
      };
      const ext = MIME_TO_EXT[contentType] ?? "bin";
      const key = `uploads/${user.id}/${randomUUID()}.${ext}`;
      const presignedUrl = await getPresignedUploadUrl(key, contentType);
      if (!presignedUrl) {
        res.json({ presignedUrl: null, publicUrl: null });
        return;
      }
      const publicUrl = buildAwsPublicUrl({ bucket: process.env.AWS_BUCKET ?? "", region: process.env.AWS_REGION ?? "", publicBaseUrl: process.env.AWS_PUBLIC_BASE_URL }, key);
      res.json({ presignedUrl, publicUrl, key });
    } catch (err) {
      const unauthorized = err instanceof Error && err.message.includes("Unauthorized");
      if (unauthorized) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("[request-presigned-upload] Erro:", err);
      res.status(500).json({ error: "Falha ao gerar URL de upload." });
    }
  });

  // ── WhatsApp approval endpoints (public, token-based) ───────────────────────
  app.get("/api/posts/approve/:token", async (req, res) => {
    const { token } = req.params;
    const result = await db.resolveApprovalToken(token, "approve");
    res.send(approvalHtmlPage(result.ok, "aprovado", result.reason));
  });

  app.get("/api/posts/reject/:token", async (req, res) => {
    const { token } = req.params;
    const result = await db.resolveApprovalToken(token, "reject");
    res.send(approvalHtmlPage(result.ok, "rejeitado", result.reason));
  });

  // ── Link curto para notícias do digest (evita URLs longas no template WhatsApp) ──
  app.get("/n/:id/:idx", async (req, res) => {
    const id = Number(req.params.id);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(id) || !Number.isInteger(idx) || idx < 0) {
      return res.redirect(302, ENV.appBaseUrl);
    }
    const items = await db.getDigestSessionNewsItems(id);
    const target = items?.[idx]?.url;
    res.redirect(302, target || ENV.appBaseUrl);
  });

  // ── WhatsApp webhook (Meta Cloud API) ──────────────────────────────────────
  // GET: Meta verification handshake
  app.get("/api/whatsapp/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && !!ENV.whatsappVerifyToken && token === ENV.whatsappVerifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send("Forbidden");
    }
  });

  // POST: incoming WhatsApp messages — match digit reply to digest session
  app.post("/api/whatsapp/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    // Verify HMAC-SHA256 signature sent by Meta in X-Hub-Signature-256
    const appSecret = ENV.whatsappAppSecret;
    if (appSecret) {
      const sigHeader = req.headers["x-hub-signature-256"];
      const sigHex = typeof sigHeader === "string" ? sigHeader.replace("sha256=", "") : "";
      const expected = createHmac("sha256", appSecret).update(req.body as Buffer).digest("hex");
      const sigBuf = Buffer.from(sigHex, "hex");
      const expBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        console.warn("[MetaWebhook] Assinatura HMAC inválida — payload rejeitado");
        res.sendStatus(403);
        return;
      }
    }

    res.sendStatus(200); // ACK Meta after signature check

    try {
      type WaEntry = {
        changes?: Array<{
          value?: {
            messages?: Array<{
              from?: string;
              type?: string;
              text?: { body?: string };
            }>;
          };
        }>;
      };
      const body = JSON.parse((req.body as Buffer).toString("utf8")) as { entry?: WaEntry[] };

      // Log everything received so we can see if replies are arriving here
      console.log("[MetaWebhook] Payload recebido:", JSON.stringify(body).slice(0, 800));

      const messages = body.entry?.flatMap((e) =>
        e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []
      ) ?? [];

      console.log(`[MetaWebhook] ${messages.length} mensagem(ns) encontrada(s)`);

      for (const msg of messages) {
        console.log(`[MetaWebhook] msg type=${msg.type ?? "?"} from=${msg.from ?? "?"} body="${msg.text?.body ?? ""}"`);
        if (msg.type !== "text" || !msg.from || !msg.text?.body) continue;

        const senderNumber = msg.from;
        const text = msg.text.body.trim();
        // User can request more news by sending "0", "mais", "outras", etc.
        const wantsMoreNews = /^(0|mais|outra[s]?|outro[s]?|mais not[ií]cias?|outras not[ií]cias?|n[aã]o|nao|refresh|trocar|mudar)$/i.test(text);
        if (wantsMoreNews) {
          const session = await db.getActiveDigestSession(senderNumber);
          if (!session) {
            console.log(`[MetaWebhook] "mais notícias" de ${senderNumber} mas sem sessão ativa`);
            continue;
          }
          void (async () => {
            try {
              const { sendWhatsAppText } = await import("./whatsapp");
              const { fetchMoreNews } = await import("./newsDigestScheduler");
              const { buildDigestTextMessage } = await import("./aggregatorWebhook");
              const excludedUrls = new Set(session.newsItems.map((i) => i.url));
              const moreItems = await fetchMoreNews(excludedUrls);
              if (moreItems.length === 0) {
                await sendWhatsAppText(senderNumber, "😔 Não encontrei outras notícias no momento. Tente novamente mais tarde.");
                return;
              }
              const msgText = buildDigestTextMessage(moreItems, "🔄 *Outras Notícias*");
              await db.saveDigestSession(session.userId, senderNumber, moreItems, undefined, msgText);
              await sendWhatsAppText(senderNumber, msgText);
              console.log(`[MetaWebhook] Mais notícias enviadas para ${senderNumber} (${moreItems.length} itens)`);
            } catch (err) {
              console.error("[MetaWebhook] Erro ao buscar mais notícias:", err);
            }
          })();
          continue;
        }

        const choiceMatch = text.match(/^[1-5]$/);
        if (!choiceMatch) {
          console.log(`[MetaWebhook] Mensagem de ${senderNumber} não é seleção (1-5): "${text}"`);
          continue;
        }

        const choiceIndex = parseInt(text, 10) - 1;

        const session = await db.getActiveDigestSession(senderNumber);
        if (!session) continue;

        const newsItem = session.newsItems[choiceIndex];
        if (!newsItem) continue;

        // Load user settings to get the aggregator webhook URL (if configured)
        const userSettings = await db.getUserDigestSettings(session.userId);
        const aggregatorWebhookUrl = userSettings?.replyWebhookUrl ?? null;

        // Fire-and-forget background generation
        void (async () => {
          // Notify aggregator about the reply immediately (before generation)
          if (aggregatorWebhookUrl) {
            fetch(aggregatorWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "digest_reply",
                from: senderNumber,
                choice: choiceIndex + 1,
                timestamp: new Date().toISOString(),
                newsItem: { title: newsItem.title, url: newsItem.url, source: newsItem.source },
              }),
            }).catch((err) => console.error("[Webhook] Falha ao notificar agregador (reply):", err));
          }

          try {
            const { sendWhatsAppText } = await import("./whatsapp");
            await sendWhatsAppText(
              senderNumber,
              `⚙️ Gerando artigo, carrossel e roteiro de Reels sobre:\n*${newsItem.title}*\n\nAguarde — pode levar até 2 minutos.`
            );
            const generated = await autoGenerateFromNews(session.userId, newsItem, senderNumber);

            // Notify aggregator about the completed generation
            if (aggregatorWebhookUrl) {
              fetch(aggregatorWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "digest_generated",
                  from: senderNumber,
                  choice: choiceIndex + 1,
                  timestamp: new Date().toISOString(),
                  newsItem: { title: newsItem.title, url: newsItem.url, source: newsItem.source },
                  articleId: generated.articleId,
                  carouselId: generated.carouselId,
                  reelsScriptId: generated.reelsScriptId,
                }),
              }).catch((err) => console.error("[Webhook] Falha ao notificar agregador (generated):", err));
            }
          } catch (err) {
            console.error("[Webhook] Erro na geração automática:", err);

            // Notify aggregator about the error
            if (aggregatorWebhookUrl) {
              fetch(aggregatorWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "digest_error",
                  from: senderNumber,
                  choice: choiceIndex + 1,
                  timestamp: new Date().toISOString(),
                  newsItem: { title: newsItem.title, url: newsItem.url, source: newsItem.source },
                  error: String(err),
                }),
              }).catch(() => {});
            }

            try {
              const { sendWhatsAppText } = await import("./whatsapp");
              await sendWhatsAppText(
                senderNumber,
                `❌ Erro ao gerar o conteúdo. Tente novamente mais tarde.`
              );
            } catch { /* silent */ }
          }
        })();
      }
    } catch (err) {
      console.error("[Webhook] Erro ao processar mensagem WhatsApp:", err);
    }
  });

  // ── Agregador webhook ──────────────────────────────────────────────────────
  // POST: recebe mensagem do usuário vinda do agregador de números.
  // Processa de forma SÍNCRONA e devolve JSON estruturado imediatamente.
  // Auth: X-Api-Key header must match N8N_SECRET env var (mesma regra dos
  // demais endpoints de automação abaixo — sem isso, qualquer requisição
  // forjada poderia disparar geração de conteúdo por IA e mensagens WhatsApp).
  app.post("/api/aggregator/webhook", express.json(), (req, res) => {
    const apiKey = req.headers["x-api-key"];
    if (!isValidN8nApiKey(apiKey)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    void handleAggregatorWebhook(req, res);
  });

  // ── n8n: match comment against active automations ────────────────────────
  // Called by n8n when Instagram sends a comment webhook.
  // Auth: X-Api-Key header must match N8N_SECRET env var.
  app.post("/api/automations/match-comment", express.json(), async (req, res) => {
    const apiKey = req.headers["x-api-key"];
    if (!isValidN8nApiKey(apiKey)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { ig_account_id, media_id, comment_text } = req.body as {
      ig_account_id?: string;
      media_id?: string;
      comment_text?: string;
    };
    if (!ig_account_id || !media_id || typeof comment_text !== "string") {
      res.status(400).json({ error: "Campos obrigatórios: ig_account_id, media_id, comment_text" });
      return;
    }
    try {
      console.log(`[CommentAutomations] Recebido: ig_account_id=${ig_account_id}, media_id=${media_id}, comment_text=${comment_text}`);
      const match = await db.matchCommentAutomation(ig_account_id, media_id, comment_text);
      console.log(`[CommentAutomations] Match: ${match ? `id=${match.id}` : "não encontrado"}`);
      if (!match) {
        res.status(404).json({ matched: false });
        return;
      }
      // Increment counter asynchronously so we don't delay the response
      void db.incrementCommentMatchedCount(match.id);
      // Fetch the access token for this user's Instagram connection
      const igConnection = await db.getInstagramConnection(match.userId);
      res.json({
        matched: true,
        automationId: match.id,
        publicReplyMessage: match.publicReplyMessage,
        dmFirstMessage: match.dmFirstMessage,
        dmFollowupMessage: match.dmFollowupMessage ?? null,
        dmLink: match.dmLink ?? null,
        accessToken: igConnection?.accessToken ?? null,
        igAccountId: igConnection?.instagramAccountId ?? null,
      });
    } catch (err) {
      console.error("[CommentAutomations] match-comment error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // ── n8n: post public reply to a comment ─────────────────────────────────
  app.post("/api/automations/post-reply", express.json(), async (req, res) => {
    const apiKey = req.headers["x-api-key"];
    if (!isValidN8nApiKey(apiKey)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { comment_id, message, ig_account_id } = req.body as {
      comment_id?: string;
      message?: string;
      ig_account_id?: string;
    };
    if (!comment_id || !message || !ig_account_id) {
      res.status(400).json({ error: "Campos obrigatórios: comment_id, message, ig_account_id" });
      return;
    }
    try {
      const igConnection = await db.getInstagramConnectionByIgId(ig_account_id);
      if (!igConnection?.accessToken) {
        res.status(404).json({ error: "Instagram connection not found" });
        return;
      }
      const url = `https://graph.facebook.com/v25.0/${comment_id}/replies`;
      const params = new URLSearchParams({ message, access_token: igConnection.accessToken });
      const apiRes = await fetch(`${url}?${params.toString()}`, { method: "POST" });
      const data = await apiRes.json() as Record<string, unknown>;
      if (!apiRes.ok) {
        console.error("[CommentAutomations] post-reply error:", data);
        res.status(apiRes.status).json({ error: data });
        return;
      }
      res.json({ success: true, id: data.id });
    } catch (err) {
      console.error("[CommentAutomations] post-reply error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // ── n8n: send DM to a commenter ─────────────────────────────────────────
  app.post("/api/automations/send-dm", express.json(), async (req, res) => {
    const apiKey = req.headers["x-api-key"];
    if (!isValidN8nApiKey(apiKey)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { ig_account_id, recipient_id, message, comment_id } = req.body as {
      ig_account_id?: string;
      recipient_id?: string;
      message?: string;
      comment_id?: string;
    };
    if (!ig_account_id || !recipient_id || !message) {
      res.status(400).json({ error: "Campos obrigatórios: ig_account_id, recipient_id, message" });
      return;
    }
    try {
      const automationId = (req.body as { automation_id?: number }).automation_id;
      let igConnection = automationId ? await db.getInstagramConnectionByAutomationId(automationId) : null;
      if (!igConnection) igConnection = await db.getInstagramConnectionByIgId(ig_account_id);
      console.log(`[send-dm] ig_account_id=${ig_account_id}, automation_id=${automationId}, comment_id=${comment_id}, connection_found=${!!igConnection}`);
      if (!igConnection?.accessToken) {
        res.status(404).json({ error: "Instagram connection not found" });
        return;
      }

      // Strategy 1: Instagram Graph API with comment_id as entry point.
      // This opens the DM window via the comment itself — no prior DM history needed.
      if (comment_id && igConnection.instagramAccountId) {
        const igUrl = `https://graph.facebook.com/v25.0/${igConnection.instagramAccountId}/messages`;
        const igBody = JSON.stringify({
          recipient: { comment_id },
          message: { text: message },
        });
        console.log(`[send-dm] trying IG comment entry: ${igUrl} comment_id=${comment_id}`);
        const igRes = await fetch(`${igUrl}?access_token=${encodeURIComponent(igConnection.accessToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: igBody,
        });
        const igData = await igRes.json() as Record<string, unknown>;
        if (igRes.ok) {
          console.log(`[send-dm] IG comment entry succeeded`, igData);
          void db.incrementDmsSentCount(automationId ?? 0);
          res.json({ success: true, message_id: igData.message_id, method: "ig_comment" });
          return;
        }
        console.warn(`[send-dm] IG comment entry failed (${igRes.status}):`, JSON.stringify(igData));
      }

      // Strategy 2: Messenger Platform (/{page-id}/messages) — requires prior DM history.
      const pageId = igConnection.facebookPageId;
      const resolvedSenderId = pageId ?? (igConnection.instagramAccountId ?? ig_account_id);
      const url = `https://graph.facebook.com/v25.0/${resolvedSenderId}/messages`;
      const body = JSON.stringify({
        recipient: { id: recipient_id },
        message: { text: message },
        messaging_type: "RESPONSE",
      });
      console.log(`[send-dm] fallback Messenger Platform: ${url}`);
      const apiRes = await fetch(`${url}?access_token=${encodeURIComponent(igConnection.accessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await apiRes.json() as Record<string, unknown>;
      if (!apiRes.ok) {
        console.error("[CommentAutomations] send-dm error:", JSON.stringify(data));
        res.status(apiRes.status).json({ error: data });
        return;
      }
      void db.incrementDmsSentCount(
        (req.body as { automation_id?: number }).automation_id ?? 0
      );
      res.json({ success: true, message_id: data.message_id });
    } catch (err) {
      console.error("[CommentAutomations] send-dm error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Landing page — served at root; all files in landing/ (logo.png, favicon.ico, etc.)
  // are served at root-level URLs so relative paths in the HTML resolve correctly.
  const landingDir = path.join(process.cwd(), "landing");
  app.use(express.static(landingDir));
  app.use("/landing-assets", express.static(landingDir));
  app.get("/demo", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "landing", "demo.html"), (err) => {
      if (err) res.redirect("/app");
    });
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  startInstagramPostScheduler();
  startNewsDigestScheduler();
  startCommentAlertScheduler();
  startRadarScheduler();
  startMetricsScheduler();
  db.migrateNullTrialDates().then(() => {
    console.log("[migrate] trialExpiresAt backfill concluido");
  }).catch((e) => console.warn("[migrate] trialExpiresAt backfill falhou:", e));
  ensureS3CorsConfigured().then((configured) => {
    if (!configured) {
      console.warn(
        "[S3] CORS não pôde ser configurado automaticamente.\n" +
        "  → Acesse AWS Console > S3 > krythos > Permissions > CORS e adicione:\n" +
        '  [{"AllowedHeaders":["*"],"AllowedMethods":["GET","HEAD","PUT"],"AllowedOrigins":["*"],"ExposeHeaders":["Content-Length","Content-Range","ETag"],"MaxAgeSeconds":3600}]'
      );
    }
  });
}

startServer().catch(console.error);
