// Backfill: cifra os campos sensíveis já existentes no banco (AES-256-GCM),
// no mesmo formato "enc:v1:" de server/_core/crypto.ts, e popula
// users.emailHash / users.emailDomain.
//
// Uso:
//   node scripts/encrypt-existing-data.mjs            # dry-run (só mostra o que faria)
//   node scripts/encrypt-existing-data.mjs --apply    # aplica
//
// É idempotente: valores que já começam com "enc:v1:" são pulados. Pode rodar 2x.

import "dotenv/config";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import mysql from "mysql2/promise";

const APPLY = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória");

function decodeKey(raw, label) {
  const t = (raw ?? "").trim();
  if (!t) throw new Error(`${label} é obrigatória`);
  const buf = /^[0-9a-fA-F]{64}$/.test(t) ? Buffer.from(t, "hex") : Buffer.from(t, "base64");
  if (buf.length !== 32) throw new Error(`${label} deve decodificar para 32 bytes`);
  return buf;
}
const ENC_KEY = decodeKey(process.env.ENCRYPTION_KEY, "ENCRYPTION_KEY");
const BI_KEY = decodeKey(process.env.BLIND_INDEX_KEY, "BLIND_INDEX_KEY");

const PREFIX = "enc:v1:";
const isEnc = (v) => typeof v === "string" && v.startsWith(PREFIX);

function encryptField(plain) {
  if (plain == null || plain === "" || isEnc(plain)) return plain ?? null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}
const blindIndex = (v) =>
  createHmac("sha256", BI_KEY).update(String(v).trim().toLowerCase(), "utf8").digest("hex");
const domainOf = (email) => {
  if (!email) return null;
  const at = String(email).lastIndexOf("@");
  return at < 0 ? null : String(email).slice(at + 1).trim().toLowerCase() || null;
};

const conn = await mysql.createConnection(databaseUrl);
let totalChanged = 0;

async function tableExists(name) {
  const [rows] = await conn.execute(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [name]
  );
  return rows.length > 0;
}

// Cifra colunas simples de texto numa tabela, por id.
async function encryptColumns(table, idCol, columns) {
  if (!(await tableExists(table))) {
    console.log(`- ${table}: tabela não existe, pulando`);
    return;
  }
  const [rows] = await conn.query(`SELECT ${idCol}, ${columns.join(", ")} FROM ${table}`);
  let changed = 0;
  for (const row of rows) {
    const sets = [];
    const params = [];
    for (const col of columns) {
      const val = row[col];
      if (val == null || isEnc(val)) continue;
      sets.push(`${col} = ?`);
      params.push(encryptField(val));
    }
    if (sets.length === 0) continue;
    changed++;
    if (APPLY) {
      params.push(row[idCol]);
      await conn.execute(`UPDATE ${table} SET ${sets.join(", ")} WHERE ${idCol} = ?`, params);
    }
  }
  console.log(`- ${table}: ${changed} linha(s) ${APPLY ? "cifradas" : "a cifrar"} (${rows.length} no total)`);
  totalChanged += changed;
}

// users precisa de tratamento especial (emailHash / emailDomain).
async function encryptUsers() {
  const [rows] = await conn.query("SELECT id, name, email, emailHash, emailDomain FROM users");
  let changed = 0;
  for (const row of rows) {
    const sets = [];
    const params = [];

    if (row.email != null && !isEnc(row.email)) {
      const plainEmail = String(row.email);
      sets.push("email = ?", "emailHash = ?", "emailDomain = ?");
      params.push(encryptField(plainEmail), blindIndex(plainEmail), domainOf(plainEmail));
    } else if (row.email != null && isEnc(row.email) && !row.emailHash) {
      // email já cifrado mas emailHash faltando — não temos o texto puro,
      // não dá pra recuperar. Loga para investigação manual.
      console.warn(`  ! user ${row.id}: email cifrado sem emailHash (backfill parcial anterior?)`);
    }

    if (row.name != null && !isEnc(row.name)) {
      sets.push("name = ?");
      params.push(encryptField(String(row.name)));
    }

    if (sets.length === 0) continue;
    changed++;
    if (APPLY) {
      params.push(row.id);
      await conn.execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
    }
  }
  console.log(`- users: ${changed} linha(s) ${APPLY ? "cifradas" : "a cifrar"} (${rows.length} no total)`);
  totalChanged += changed;
}

console.log(APPLY ? "== APLICANDO ==" : "== DRY-RUN (use --apply para gravar) ==");

try {
  await encryptUsers();
  await encryptColumns("instagram_connections", "id", ["accessToken"]);
  await encryptColumns("canva_connections", "id", ["accessToken", "refreshToken"]);
  await encryptColumns("linkedin_connections", "id", ["accessToken", "refreshToken"]);
  await encryptColumns("search_console_connections", "id", ["accessToken", "refreshToken"]);
  await encryptColumns("chat_messages", "id", ["content"]);
  await encryptColumns("articles", "id", ["content", "summary", "topic"]);
  await encryptColumns("user_digest_settings", "id", ["reply_webhook_url"]);

  console.log(`\nTotal: ${totalChanged} linha(s) ${APPLY ? "atualizadas" : "seriam atualizadas"}.`);
  if (!APPLY) console.log("Nada foi gravado. Rode com --apply para aplicar.");
} finally {
  await conn.end();
}
