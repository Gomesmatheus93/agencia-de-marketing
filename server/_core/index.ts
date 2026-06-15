import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { randomUUID } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { startInstagramPostScheduler } from "./instagramPostScheduler";
import { startNewsDigestScheduler } from "./newsDigestScheduler";
import { autoGenerateFromNews } from "./newsAutoGenerator";
import { serveStatic, setupVite } from "./vite";
import { validateRequiredEnv, ENV } from "./env";
import { sdk } from "./sdk";
import { storagePut, getMetaFetchableStorageUrl, getPresignedUploadUrl, buildAwsPublicUrl, ensureS3CorsConfigured } from "../storage";
import * as db from "../db";

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
    <a href="/">Abrir plataforma</a>
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
        const status = err instanceof Error && err.message.includes("Unauthorized") ? 401 : 500;
        res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
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
      const status = err instanceof Error && err.message.includes("Unauthorized") ? 401 : 500;
      res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
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

  // ── WhatsApp webhook (Meta Cloud API) ──────────────────────────────────────
  // GET: Meta verification handshake
  app.get("/api/whatsapp/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === ENV.whatsappVerifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send("Forbidden");
    }
  });

  // POST: incoming WhatsApp messages — match digit reply to digest session
  app.post("/api/whatsapp/webhook", express.json(), async (req, res) => {
    res.sendStatus(200); // always ACK Meta first to avoid retries

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
      const body = req.body as { entry?: WaEntry[] };
      const messages = body.entry?.flatMap((e) =>
        e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []
      ) ?? [];

      for (const msg of messages) {
        if (msg.type !== "text" || !msg.from || !msg.text?.body) continue;

        const senderNumber = msg.from;
        const text = msg.text.body.trim();
        const choiceMatch = text.match(/^[1-5]$/);
        if (!choiceMatch) continue;

        const choiceIndex = parseInt(text, 10) - 1;

        const session = await db.getActiveDigestSession(senderNumber);
        if (!session) continue;

        const newsItem = session.newsItems[choiceIndex];
        if (!newsItem) continue;

        // Fire-and-forget background generation
        void (async () => {
          try {
            const { sendWhatsAppText } = await import("./whatsapp");
            await sendWhatsAppText(
              senderNumber,
              `⚙️ Gerando artigo e carrossel sobre:\n*${newsItem.title}*\n\nAguarde — pode levar até 2 minutos.`
            );
            await autoGenerateFromNews(session.userId, newsItem, senderNumber);
          } catch (err) {
            console.error("[Webhook] Erro na geração automática:", err);
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

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
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
