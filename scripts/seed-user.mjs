import "dotenv/config";
import { createCipheriv, createHash, createHmac, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const scryptAsync = promisify(scrypt);

const databaseUrl = process.env.DATABASE_URL;
const email = (process.env.SEED_USER_EMAIL ?? "admin@example.com").trim().toLowerCase();
const password = process.env.SEED_USER_PASSWORD;
const name = process.env.SEED_USER_NAME ?? "Administrador";
const role = process.env.SEED_USER_ROLE ?? "admin";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed a user");
}

if (!["user", "admin"].includes(role)) {
  throw new Error("SEED_USER_ROLE must be either 'user' or 'admin'");
}

if (!email) {
  throw new Error("SEED_USER_EMAIL is required");
}

if (!password || password.length < 6) {
  throw new Error("SEED_USER_PASSWORD is required and must have at least 6 characters");
}

// ── Espelha server/_core/crypto.ts (mesmo formato "enc:v1:" e blind index) ──
function decodeKey(raw, label) {
  const t = (raw ?? "").trim();
  if (!t) throw new Error(`${label} é obrigatória para o seed.`);
  const buf = /^[0-9a-fA-F]{64}$/.test(t) ? Buffer.from(t, "hex") : Buffer.from(t, "base64");
  if (buf.length !== 32) throw new Error(`${label} deve decodificar para 32 bytes.`);
  return buf;
}
const ENC_KEY = decodeKey(process.env.ENCRYPTION_KEY, "ENCRYPTION_KEY");
const BI_KEY = decodeKey(process.env.BLIND_INDEX_KEY, "BLIND_INDEX_KEY");

function encryptField(plain) {
  if (plain == null || plain === "") return plain ?? null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "enc:v1:" + Buffer.concat([iv, tag, ct]).toString("base64");
}
function blindIndex(value) {
  return createHmac("sha256", BI_KEY).update(value.trim().toLowerCase(), "utf8").digest("hex");
}

// Formato de senha novo: s2$N$r$p$salt$hash (com pepper opcional)
async function hashPassword(value) {
  const pepper = process.env.PASSWORD_PEPPER ?? "";
  const input = pepper ? createHmac("sha256", pepper).update(value, "utf8").digest("base64") : value;
  const N = 2 ** 15, r = 8, p = 1;
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(input, salt, 64, { N, r, p, maxmem: 256 * N * r * p });
  return `s2$${N}$${r}$${p}$${salt}$${hash.toString("hex")}`;
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  const emailHash = blindIndex(email);
  const emailDomain = email.slice(email.lastIndexOf("@") + 1) || null;

  const existingUsers = await sql`
    SELECT "openId" FROM users WHERE "emailHash" = ${emailHash} LIMIT 1
  `;
  const fallbackOpenId = `seed_${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
  const openId = existingUsers[0]?.openId ?? fallbackOpenId;
  const passwordHash = await hashPassword(password);
  const encEmail = encryptField(email);
  const encName = encryptField(name);

  // Conta criada pelo seed já entra com e-mail verificado.
  await sql`
    INSERT INTO users ("openId", name, email, "emailHash", "emailDomain", "loginMethod", "passwordHash", role, "emailVerifiedAt")
    VALUES (${openId}, ${encName}, ${encEmail}, ${emailHash}, ${emailDomain}, 'email', ${passwordHash}, ${role}, NOW())
    ON CONFLICT ("openId") DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      "emailHash" = EXCLUDED."emailHash",
      "emailDomain" = EXCLUDED."emailDomain",
      "loginMethod" = 'email',
      "passwordHash" = EXCLUDED."passwordHash",
      role = EXCLUDED.role,
      "emailVerifiedAt" = COALESCE(users."emailVerifiedAt", NOW()),
      "updatedAt" = NOW(),
      "lastSignedIn" = NOW()
  `;

  // Identidade fixa da Alle Energia (a plataforma não tem mais tela de brand kit):
  // usada pela IA em todas as gerações. Só é criada se a conta ainda não tiver uma.
  const [seeded] = await sql`SELECT id, "activeBrandKitId" FROM users WHERE "openId" = ${openId}`;
  const [existingKit] = await sql`SELECT id FROM brand_kits WHERE "userId" = ${seeded.id} LIMIT 1`;
  if (!existingKit) {
    const [kit] = await sql`
      INSERT INTO brand_kits ("userId", "companyName", tagline, industry, "toneOfVoice", "primaryColor", "secondaryColor", "accentColor", "instagramHandle", "defaultCta")
      VALUES (${seeded.id}, 'Alle Energia', 'Autonomia e Liberdade Energética', 'Energia', 'professional', '#7c00ae', '#ff7300', '#ff9a3c', '@alleenergia', 'Fale com a Alle Energia')
      RETURNING id
    `;
    await sql`UPDATE users SET "activeBrandKitId" = ${kit.id} WHERE id = ${seeded.id}`;
  }

  console.log(`Seed user ready: ${email}`);
  console.log("Password configured from SEED_USER_PASSWORD.");
} finally {
  await sql.end();
}
