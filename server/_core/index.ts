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
import { serveStatic, setupVite } from "./vite";
import { validateRequiredEnv } from "./env";
import { sdk } from "./sdk";
import { storagePut, getMetaFetchableStorageUrl, getPresignedUploadUrl, buildAwsPublicUrl, ensureS3CorsConfigured } from "../storage";

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
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));
  // Serve uploaded images
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  // Image proxy — allows canvas to load cross-origin images without CORS taint
  app.get("/api/image-proxy", async (req, res) => {
    const url = typeof req.query.url === "string" ? req.query.url : "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      res.status(400).send("Invalid URL"); return;
    }
    try {
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
    const url = typeof req.query.url === "string" ? req.query.url : "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      res.status(400).send("Invalid URL"); return;
    }
    try {
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
