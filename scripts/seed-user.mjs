import "dotenv/config";
import { createHash, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import mysql from "mysql2/promise";

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

async function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(value, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

const connection = await mysql.createConnection(databaseUrl);

try {
  const [existingUsers] = await connection.execute(
    "SELECT openId FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  const fallbackOpenId = `seed_${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
  const openId = existingUsers[0]?.openId ?? fallbackOpenId;
  const passwordHash = await hashPassword(password);

  await connection.execute(
    `INSERT INTO users (openId, name, email, loginMethod, passwordHash, role)
     VALUES (?, ?, ?, 'email', ?, ?)
     ON DUPLICATE KEY UPDATE
       name = ?,
       email = ?,
       loginMethod = 'email',
       passwordHash = ?,
       role = ?,
       updatedAt = NOW(),
       lastSignedIn = NOW()`,
    [openId, name, email, passwordHash, role, name, email, passwordHash, role]
  );

  console.log(`Seed user ready: ${email}`);
  console.log("Password configured from SEED_USER_PASSWORD.");
} finally {
  await connection.end();
}
