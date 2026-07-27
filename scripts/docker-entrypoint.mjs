import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env from /app/.env if it exists (useful when mounted as a volume in production)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

async function run(command, args) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => child.kill(signal));
  }

  const { code, signal } = await new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  if (signal) {
    process.kill(process.pid, signal);
    return 1;
  }

  return code ?? 0;
}

if (process.env.DATABASE_URL && process.env.RUN_MIGRATIONS !== "false") {
  console.log("Running database migrations...");
  const migrationCode = await run(process.execPath, ["scripts/migrate.mjs"]);
  if (migrationCode !== 0) {
    process.exit(migrationCode);
  }
} else {
  console.log("Skipping database migrations.");
}

if (process.env.SEED_USER_PASSWORD) {
  console.log("Running user seed...");
  const seedCode = await run(process.execPath, ["scripts/seed-user.mjs"]);
  if (seedCode !== 0) {
    process.exit(seedCode);
  }
} else {
  console.log("Skipping user seed: SEED_USER_PASSWORD is not set.");
}

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
  process.exit(0);
}

process.exit(await run(command, args));
