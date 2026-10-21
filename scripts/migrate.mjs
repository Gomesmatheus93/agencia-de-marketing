import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? "drizzle";
const maxAttempts = parsePositiveInteger(process.env.MIGRATION_ATTEMPTS, 10);
const retryDelayMs = parsePositiveInteger(process.env.MIGRATION_RETRY_DELAY_MS, 3000);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

function parsePositiveInteger(value, fallback) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrations() {
  const client = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });

  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    await runMigrations();
    console.log("Database migrations applied.");
    process.exit(0);
  } catch (error) {
    if (attempt === maxAttempts) {
      throw error;
    }

    console.warn(
      `Database migration attempt ${attempt}/${maxAttempts} failed. Retrying in ${retryDelayMs}ms...`
    );
    await delay(retryDelayMs);
  }
}
