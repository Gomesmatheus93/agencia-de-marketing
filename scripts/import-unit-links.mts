// Importa o link de adesão e o QR code de cada academia (pasta "QR CODE'S das Unidades Allp Fit"
// ou a do mídia kit: uma subpasta por academia com um .png do QR e um .pdf/.docx/.txt com o link).
//
//   npx tsx --env-file=.env scripts/import-unit-links.mts "<pasta>" [--dry-run]
//   npx tsx --env-file=.env scripts/import-unit-links.mts --training "<arquivo.pdf>" ["Título"]
//
// A academia é ligada pelo nome normalizado (unitKey); se não existir, é cadastrada aguardando o 1º login.
import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { unitMaterials, units } from "../drizzle/schema";
import { getDb } from "../server/db";
import { storagePut } from "../server/storage";
import { PENDING_UNIT_PREFIX, unitKey } from "../server/_core/unitKey";
import { decodeQr } from "../server/_core/qr";

const args = process.argv.slice(2);
const conn = await getDb();
if (!conn) throw new Error("Banco indisponível.");

// ── Treinamento (biblioteca geral) ──
if (args[0] === "--training") {
  const file = args[1];
  const title = args[2] ?? path.basename(file, path.extname(file));
  const data = await readFile(file);
  const safe = path.basename(file).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-");
  const { url } = await storagePut(`unit-training/${safe}`, data, "application/pdf");
  await conn.delete(unitMaterials).where(and(isNull(unitMaterials.unitId), eq(unitMaterials.kind, "treinamento"), eq(unitMaterials.fileName, path.basename(file))));
  await conn.insert(unitMaterials).values({ unitId: null, kind: "treinamento", title, fileUrl: url, fileName: path.basename(file), contentType: "application/pdf", sizeBytes: data.length, createdByUserId: Number(process.env.KIT_ADMIN_ID ?? 1) });
  console.log(`✓ Treinamento: ${title} (${(data.length / 1048576).toFixed(1)} MB)`);
  process.exit(0);
}

const root = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!root) throw new Error("Informe a pasta.");

function linkFrom(file: string): string | null {
  const ext = path.extname(file).toLowerCase();
  let text = "";
  try {
    if (ext === ".pdf") text = execFileSync("pdftotext", [file, "-"], { encoding: "utf8" });
    else if (ext === ".docx") text = execFileSync("unzip", ["-p", file, "word/document.xml", "word/_rels/document.xml.rels"], { encoding: "utf8" });
    else if (ext === ".txt") text = execFileSync("cat", [file], { encoding: "utf8" });
  } catch { return null; }
  return text.match(/https?:\/\/[^\s"<>]+/g)?.find((u) => !/schemas|openxmlformats|microsoft\.com|w3\.org/.test(u)) ?? null;
}

const allUnits = await conn.select().from(units);
const folders = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort((a, b) => a.localeCompare(b, "pt-BR"));
let ok = 0;
for (const folder of folders) {
  const dir = path.join(root, folder);
  const files = (await readdir(dir)).map((f) => path.join(dir, f));
  const isFile = async (f: string) => (await stat(f)).isFile();
  const docs = [];
  for (const f of files) if (/\.(pdf|docx|txt)$/i.test(f) && (await isFile(f))) docs.push(f);
  const link = docs.map(linkFrom).find(Boolean) ?? null;
  const qr = files.find((f) => /\.png$/i.test(f)) ?? null;
  const key = unitKey(folder);
  let unit = allUnits.find((u) => unitKey(u.name) === key);
  console.log(`${folder.padEnd(38)} ${(link ?? "SEM LINK").padEnd(42)} ${qr ? "QR ✓" : "SEM QR"}  ${unit ? "" : "(nova)"}`);
  if (dryRun || (!link && !qr)) continue;
  if (!unit) {
    [unit] = await conn.insert(units).values({ code: `${PENDING_UNIT_PREFIX}${key}`.slice(0, 64), name: folder.replace(/\s*-\s*/g, " - ") }).returning();
    allUnits.push(unit);
  }
  const qrBuf = qr ? await readFile(qr) : null;
  const qrUrl = qrBuf ? (await storagePut(`unit-qr/${key}.png`, qrBuf, "image/png")).url : unit.qrUrl;
  // O QR do mídia kit é gerado com o conteúdo exato do QR original (que pode diferir do link exibido).
  const qrData = qrBuf ? (await decodeQr(qrBuf)) ?? link : unit.qrData ?? link;
  await conn.update(units).set({ signupUrl: link ?? unit.signupUrl, qrUrl, qrData }).where(eq(units.id, unit.id));
  ok++;
}
console.log(`\n${folders.length} pastas · ${ok} academias atualizadas${dryRun ? " (simulação)" : ""}`);
process.exit(0);
