// Importa a pasta do mídia kit: uma subpasta por academia ("Americana - SP", "jacareí - SP"…).
//
//   npx tsx --env-file=.env scripts/import-midia-kit.mts "<pasta>" [--dry-run] [--only "Americana - SP"]
//
// - Cada academia é ligada pelo nome normalizado (sem acento, maiúscula, espaço ou hífen).
//   Se ainda não existe (ninguém dela entrou pelo login unificado), é cadastrada com código
//   provisório "kit:…"; no primeiro login, o sistema da Alle troca pelo código real (alleSso.ts).
// - O kit da academia é substituído a cada execução (rodar de novo não duplica).
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { unitMaterials, units } from "../drizzle/schema";
import { getDb } from "../server/db";
import { storagePut } from "../server/storage";
import { PENDING_UNIT_PREFIX, unitKey } from "../server/_core/unitKey";

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--only");
const dryRun = args.includes("--dry-run");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const ADMIN_ID = Number(process.env.KIT_ADMIN_ID ?? 1);
if (!root) throw new Error("Informe a pasta do mídia kit.");

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf", txt: "text/plain; charset=utf-8", zip: "application/zip", mp4: "video/mp4",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const SMALL = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "itaquaquecetuba monte belo - SP" → "Itaquaquecetuba Monte Belo - SP"; "material fisico" → "Material Físico". */
function pretty(text: string) {
  const words = text.trim().replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").split(" ");
  return words.map((w, i) => {
    if (i === words.length - 1 && words[i - 1] === "-" && /^[A-Za-z]{2}$/.test(w)) return w.toUpperCase(); // UF no fim
    if (/^[IVX]+$/.test(w)) return w; // numeral romano
    const lw = w.toLowerCase();
    if (i > 0 && SMALL.has(lw)) return lw;
    const fixed = lw === "fisico" ? "físico" : lw;
    return fixed.charAt(0).toUpperCase() + fixed.slice(1);
  }).join(" ");
}

async function walk(dir: string, rel = ""): Promise<Array<{ abs: string; rel: string }>> {
  const out: Array<{ abs: string; rel: string }> = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "Thumbs.db" || e.name === "desktop.ini") continue;
    const abs = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(abs, r)));
    else out.push({ abs, rel: r });
  }
  return out;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const conn = await getDb();
if (!conn) throw new Error("Banco indisponível.");
const allUnits = await conn.select().from(units);
const folders = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name)
  .filter((n) => !only || unitKey(n) === unitKey(only)).sort((a, b) => a.localeCompare(b, "pt-BR"));

let totalFiles = 0, totalBytes = 0;
const report: string[] = [];
for (const folder of folders) {
  const key = unitKey(folder);
  const files = await walk(path.join(root, folder));
  const bytes = (await Promise.all(files.map((f) => stat(f.abs)))).reduce((s, st) => s + st.size, 0);
  let unit = allUnits.find((u) => unitKey(u.name) === key);
  const status = unit ? (unit.code.startsWith(PENDING_UNIT_PREFIX) ? "já cadastrada (aguardando login)" : "LIGADA ao sistema da Alle") : "nova";
  report.push(`${pretty(folder).padEnd(40)} ${String(files.length).padStart(3)} arquivos  ${(bytes / 1048576).toFixed(1).padStart(6)} MB  ${status}`);
  totalFiles += files.length; totalBytes += bytes;
  if (dryRun) continue;

  if (!unit) {
    [unit] = await conn.insert(units).values({ code: `${PENDING_UNIT_PREFIX}${key}`.slice(0, 64), name: pretty(folder) }).returning();
    allUnits.push(unit);
  }
  const rows: Array<typeof unitMaterials.$inferInsert> = [];
  await pool(files, 6, async (f) => {
    const ext = path.extname(f.abs).slice(1).toLowerCase();
    const data = await readFile(f.abs);
    const hash = createHash("sha1").update(data).digest("hex").slice(0, 10);
    const safe = path.basename(f.abs).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-");
    const { url } = await storagePut(`unit-kits/${key}/${hash}-${safe}`, data, MIME[ext] ?? "application/octet-stream");
    const dirParts = path.dirname(f.rel) === "." ? [] : path.dirname(f.rel).split("/").map(pretty);
    const base = path.basename(f.abs, path.extname(f.abs));
    // Nome só com números ("35.png") não diz nada: usa o nome da pasta.
    const title = /^[\d\s()_-]+$/.test(base) && dirParts.length ? dirParts[dirParts.length - 1] : base;
    rows.push({
      unitId: unit!.id, kind: "midia_kit", title: title.slice(0, 255), description: dirParts.join(" › ") || null,
      fileUrl: url, fileName: path.basename(f.abs).slice(0, 255), contentType: MIME[ext] ?? "application/octet-stream",
      sizeBytes: data.length, createdByUserId: ADMIN_ID,
    });
  });
  await conn.transaction(async (tx) => {
    await tx.delete(unitMaterials).where(and(eq(unitMaterials.unitId, unit!.id), eq(unitMaterials.kind, "midia_kit")));
    if (rows.length) await tx.insert(unitMaterials).values(rows);
  });
  console.log(`✓ ${pretty(folder)}: ${rows.length} arquivos`);
}

console.log(`\n${report.join("\n")}\n\n${folders.length} academias · ${totalFiles} arquivos · ${(totalBytes / 1048576).toFixed(0)} MB${dryRun ? " (simulação, nada enviado)" : ""}`);
process.exit(0);
