import { spawn } from "node:child_process";

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
