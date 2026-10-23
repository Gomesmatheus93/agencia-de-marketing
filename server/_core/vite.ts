import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { pathToFileURL } from "url";

export async function setupVite(app: Express, server: Server) {
  const viteConfigUrl = pathToFileURL(path.resolve(process.cwd(), "vite.config.ts")).href;
  const [{ createServer: createViteServer }, { default: viteConfig }] = await Promise.all([
    import("vite"),
    import(viteConfigUrl),
  ]);

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Serve React SPA for /app and all sub-routes (client-side routing)
  app.use("*", async (req, res, next) => {
    if (!req.originalUrl.startsWith("/app")) return next();
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Arquivos do build têm hash no nome: podem ficar em cache para sempre. Um
  // arquivo que não existe mais (aba aberta com a versão anterior durante um
  // deploy) devolve 404, não o index.html — senão o navegador recebe HTML no
  // lugar do CSS e a página aparece sem estilo.
  app.use("/app/assets", express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y" }));
  app.use("/app/assets", (_req, res) => res.status(404).end());
  // Platform served under /app — mirrors Vite base: "/app"
  app.use("/app", express.static(distPath, { index: false }));
  // Catch-all: serve React index.html for any /app route (client-side routing).
  // Sem cache, para o navegador sempre pegar os nomes de arquivo do build atual.
  app.use("*", (req, res, next) => {
    if (!req.originalUrl.startsWith("/app")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
