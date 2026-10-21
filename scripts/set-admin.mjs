import "dotenv/config";
import { createHmac } from "node:crypto";
import postgres from "postgres";

const email = process.argv[2];
if (!email) { console.error("Usage: node scripts/set-admin.mjs <email>"); process.exit(1); }

// O e-mail fica cifrado no banco — a busca é pelo blind index (espelha server/_core/crypto.ts).
function decodeKey(raw, label) {
  const t = (raw ?? "").trim();
  if (!t) throw new Error(`${label} é obrigatória.`);
  const buf = /^[0-9a-fA-F]{64}$/.test(t) ? Buffer.from(t, "hex") : Buffer.from(t, "base64");
  if (buf.length !== 32) throw new Error(`${label} deve decodificar para 32 bytes.`);
  return buf;
}
const BI_KEY = decodeKey(process.env.BLIND_INDEX_KEY, "BLIND_INDEX_KEY");
const emailHash = createHmac("sha256", BI_KEY).update(email.trim().toLowerCase(), "utf8").digest("hex");

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const res = await sql`UPDATE users SET role = 'admin' WHERE "emailHash" = ${emailHash}`;
  if (res.count === 0) { console.error(`Usuário não encontrado: ${email}`); process.exit(1); }
  console.log(`✓ ${email} agora é admin.`);
} finally {
  await sql.end();
}
