/**
 * test-instagram-fetch.mjs
 *
 * Standalone diagnostic script for Instagram image fetching.
 * Run with: node test-instagram-fetch.mjs
 *
 * What it tests:
 *   1. Loads .env and connects to MySQL
 *   2. Reads the first row from instagram_connections
 *   3. Calls the Graph API /profile endpoint
 *   4. Calls the Graph API /media endpoint
 *   5. Downloads the first media_url and inspects bytes + headers
 *   6. Calls the Instagram internal web JSON API (i.instagram.com)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── 1. Load .env ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");

if (!fs.existsSync(envPath)) {
  console.error(`[FATAL] .env file not found at: ${envPath}`);
  process.exit(1);
}

// Minimal .env parser — handles KEY=VALUE, ignores comments and blank lines.
// Using this instead of dotenv so the script has zero compile step requirements.
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  // Strip surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const DATABASE_URL         = process.env.DATABASE_URL ?? "";
const META_GRAPH_API_BASE  = process.env.META_GRAPH_API_BASE_URL ?? "https://graph.facebook.com";
const META_GRAPH_VERSION   = process.env.META_GRAPH_API_VERSION   ?? "v25.0";
const GRAPH_BASE           = `${META_GRAPH_API_BASE}/${META_GRAPH_VERSION}`;

console.log("\n=== Instagram Fetch Diagnostic ===");
console.log(`Date           : ${new Date().toISOString()}`);
console.log(`DATABASE_URL   : ${DATABASE_URL ? DATABASE_URL.replace(/:\/\/[^@]+@/, "://<redacted>@") : "(not set)"}`);
console.log(`Graph Base URL : ${GRAPH_BASE}`);
console.log("");

if (!DATABASE_URL) {
  console.error("[FATAL] DATABASE_URL is not set in .env");
  process.exit(1);
}

// ── 2. Connect to MySQL and fetch first instagram_connection ──────────────────

let mysql2;
try {
  mysql2 = await import("mysql2/promise");
} catch {
  console.error("[FATAL] mysql2 package not found. Run: npm install mysql2");
  process.exit(1);
}

console.log("--- Step 1: Database connection ---");

let connection;
try {
  connection = await mysql2.createConnection(DATABASE_URL);
  console.log("[OK] Connected to MySQL");
} catch (err) {
  console.error("[FAIL] Could not connect to MySQL:", err.message);
  process.exit(1);
}

let igRow;
try {
  const [rows] = await connection.execute(
    "SELECT id, userId, instagramAccountId, facebookPageId, username, name, profilePictureUrl, accessToken, tokenExpiresAt, tokenSource FROM instagram_connections LIMIT 1"
  );
  igRow = rows[0];
} catch (err) {
  console.error("[FAIL] Query on instagram_connections failed:", err.message);
  await connection.end();
  process.exit(1);
}

if (!igRow) {
  console.warn("[WARN] No rows found in instagram_connections table. Nothing to test.");
  await connection.end();
  process.exit(0);
}

await connection.end();

console.log("[OK] Found instagram_connections row:");
console.log(`  id                 : ${igRow.id}`);
console.log(`  userId             : ${igRow.userId}`);
console.log(`  instagramAccountId : ${igRow.instagramAccountId}`);
console.log(`  facebookPageId     : ${igRow.facebookPageId ?? "(null)"}`);
console.log(`  username           : ${igRow.username ?? "(null)"}`);
console.log(`  name               : ${igRow.name ?? "(null)"}`);
console.log(`  tokenSource        : ${igRow.tokenSource ?? "(null)"}`);
console.log(`  tokenExpiresAt     : ${igRow.tokenExpiresAt ?? "(null)"}`);
console.log(`  profilePictureUrl  : ${igRow.profilePictureUrl ? igRow.profilePictureUrl.slice(0, 80) + "..." : "(null)"}`);
console.log(`  accessToken        : ${igRow.accessToken ? igRow.accessToken.slice(0, 20) + "...[redacted]" : "(null)"}`);
console.log("");

const { instagramAccountId, accessToken, tokenSource } = igRow;

if (!accessToken) {
  console.error("[FATAL] accessToken is empty — cannot make Graph API calls");
  process.exit(1);
}

// Note: tokenSource "instagram" means the token was issued via Instagram Login
// and should use graph.instagram.com, but currently the code always uses
// META_GRAPH_API_BASE_URL (graph.facebook.com). This could be a root cause.
if (tokenSource === "instagram") {
  console.warn(
    "[WARN] tokenSource = 'instagram' — this token was issued via Instagram Login.\n" +
    "       The production code currently calls graph.facebook.com, but Instagram Login\n" +
    "       tokens should call graph.instagram.com. This mismatch may cause empty images.\n"
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function safeFetch(label, url, options = {}) {
  console.log(`[FETCH] ${label}`);
  console.log(`  URL: ${url.replace(accessToken, "<token>")}`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    console.log(`  Status       : ${res.status} ${res.statusText}`);
    console.log(`  Content-Type : ${res.headers.get("content-type") ?? "(none)"}`);
    console.log(`  Content-Len  : ${res.headers.get("content-length") ?? "(none)"}`);
    return res;
  } catch (err) {
    console.error(`  [ERROR] ${err.message}`);
    return null;
  }
}

// ── 3. Graph API — profile ────────────────────────────────────────────────────

console.log("--- Step 2: Graph API — profile endpoint ---");
const profileUrl = `${GRAPH_BASE}/${instagramAccountId}?fields=name,username,profile_picture_url&access_token=${accessToken}`;
const profileRes = await safeFetch("Profile", profileUrl);

if (profileRes) {
  try {
    const profileJson = await profileRes.json();
    console.log("  Response JSON:", JSON.stringify(profileJson, null, 2));

    if (profileJson.error) {
      console.error(`  [GRAPH ERROR] code=${profileJson.error.code} type=${profileJson.error.type}`);
      console.error(`               ${profileJson.error.message}`);
    } else {
      console.log(`  [OK] username=${profileJson.username}, name=${profileJson.name}`);
      if (profileJson.profile_picture_url) {
        console.log(`  [OK] profile_picture_url starts with: ${profileJson.profile_picture_url.slice(0, 60)}...`);
      } else {
        console.warn("  [WARN] profile_picture_url is missing from response");
      }
    }
  } catch (err) {
    console.error("  [ERROR] Could not parse JSON:", err.message);
  }
}

console.log("");

// ── 4. Graph API — media ──────────────────────────────────────────────────────

console.log("--- Step 3: Graph API — media endpoint (limit=3) ---");
const mediaUrl = `${GRAPH_BASE}/${instagramAccountId}/media?fields=media_url,thumbnail_url,media_type,timestamp&limit=3&access_token=${accessToken}`;
const mediaRes = await safeFetch("Media list", mediaUrl);

let firstMediaUrl = null;
let firstThumbnailUrl = null;

if (mediaRes) {
  try {
    const mediaJson = await mediaRes.json();

    if (mediaJson.error) {
      console.error(`  [GRAPH ERROR] code=${mediaJson.error.code} type=${mediaJson.error.type}`);
      console.error(`               ${mediaJson.error.message}`);
    } else {
      const items = mediaJson.data ?? [];
      console.log(`  [OK] ${items.length} media item(s) returned`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`\n  Item ${i + 1}:`);
        console.log(`    media_type    : ${item.media_type ?? "(null)"}`);
        console.log(`    timestamp     : ${item.timestamp ?? "(null)"}`);
        console.log(`    media_url     : ${item.media_url ? item.media_url.slice(0, 80) + "..." : "(null)"}`);
        console.log(`    thumbnail_url : ${item.thumbnail_url ? item.thumbnail_url.slice(0, 80) + "..." : "(null)"}`);

        if (i === 0) {
          firstMediaUrl     = item.media_url     ?? null;
          firstThumbnailUrl = item.thumbnail_url ?? null;
        }
      }

      if (items.length === 0) {
        console.warn("  [WARN] Empty data array — account has no media or token lacks permission");
      }
    }
  } catch (err) {
    console.error("  [ERROR] Could not parse JSON:", err.message);
  }
}

console.log("");

// ── 5. Download first media_url and inspect bytes ─────────────────────────────

const targetImageUrl = firstThumbnailUrl ?? firstMediaUrl;

if (targetImageUrl) {
  console.log("--- Step 4: Download first image and inspect bytes ---");
  const imgRes = await safeFetch(
    "First image download",
    targetImageUrl,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
        Referer: "https://www.instagram.com/",
      },
    }
  );

  if (imgRes) {
    try {
      const arrayBuffer = await imgRes.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      console.log(`  Downloaded bytes  : ${buf.byteLength}`);
      console.log(`  First 100 bytes   : ${buf.slice(0, 100).toString("hex")}`);

      // Detect common image magic bytes
      const magic = buf.slice(0, 4).toString("hex");
      if (magic.startsWith("ffd8ff"))     console.log("  Magic bytes       : JPEG (ffd8ff...)");
      else if (magic === "89504e47")      console.log("  Magic bytes       : PNG (89504e47)");
      else if (magic === "47494638")      console.log("  Magic bytes       : GIF (47494638)");
      else if (magic.startsWith("5249"))  console.log("  Magic bytes       : RIFF/WEBP (52494646)");
      else                                console.log(`  Magic bytes       : UNKNOWN (${magic}) — may not be an image`);

      // Check if it's the Instagram logo placeholder (known small size)
      if (buf.byteLength < 5000) {
        console.warn(`  [WARN] File is very small (${buf.byteLength} bytes) — may be a placeholder/logo`);
      }
    } catch (err) {
      console.error("  [ERROR] Could not read body:", err.message);
    }
  }
} else {
  console.log("--- Step 4: SKIPPED — no media_url or thumbnail_url returned ---");
}

console.log("");

// ── 6. Instagram internal web JSON API ────────────────────────────────────────

const testUsername = igRow.username ?? "alleenergia";
console.log(`--- Step 5: Instagram internal web JSON API (@${testUsername}) ---`);

const mobileEndpoint = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(testUsername)}`;
const webEndpoint    = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(testUsername)}`;

for (const [label, url, headers] of [
  [
    "Mobile endpoint (i.instagram.com)",
    mobileEndpoint,
    {
      "x-ig-app-id": "936619743392459",
      "User-Agent": "Instagram 155.0.0.37.107 Android (23/6.0.1; 320dpi; 720x1280; samsung; SM-A310F; a3xelte; samsungexynos7580; en_GB; 239490550)",
      "Accept": "*/*",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  ],
  [
    "Web endpoint (www.instagram.com)",
    webEndpoint,
    {
      "x-ig-app-id": "936619743392459",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Referer": `https://www.instagram.com/${testUsername}/`,
      "x-requested-with": "XMLHttpRequest",
    },
  ],
]) {
  console.log(`\n  [${label}]`);
  console.log(`  URL: ${url}`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);

    console.log(`  Status       : ${res.status} ${res.statusText}`);
    console.log(`  Content-Type : ${res.headers.get("content-type") ?? "(none)"}`);
    console.log(`  Content-Len  : ${res.headers.get("content-length") ?? "(none)"}`);

    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && ct.includes("json")) {
      try {
        const json = await res.json();
        const user = json?.data?.user ?? json?.user ?? null;
        if (user) {
          console.log(`  [OK] Got user: @${user.username ?? user.id}, posts=${json?.data?.user?.edge_owner_to_timeline_media?.edges?.length ?? "?"}`);
        } else {
          console.warn("  [WARN] Response parsed but no user object found");
          console.log("  Raw keys:", Object.keys(json).join(", "));
        }
      } catch {
        console.warn("  [WARN] Could not parse JSON body");
      }
    } else if (res.ok) {
      const text = await res.text();
      console.log(`  [INFO] Non-JSON response. First 200 chars: ${text.slice(0, 200)}`);
    } else {
      const text = await res.text();
      console.warn(`  [FAIL] HTTP ${res.status}. Body start: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`  [ERROR] ${err.message}`);
  }
}

// ── 7. Also test @alleenergia explicitly if different from stored username ─────

const fixedTestUser = "alleenergia";
if (testUsername !== fixedTestUser) {
  console.log(`\n--- Step 6: Instagram internal web JSON API (@${fixedTestUser} — hardcoded test) ---`);
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(fixedTestUser)}`;
  console.log(`  URL: ${url}`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      headers: {
        "x-ig-app-id": "936619743392459",
        "User-Agent": "Instagram 155.0.0.37.107 Android (23/6.0.1; 320dpi; 720x1280; samsung; SM-A310F; a3xelte; samsungexynos7580; en_GB; 239490550)",
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    console.log(`  Status       : ${res.status} ${res.statusText}`);
    console.log(`  Content-Type : ${res.headers.get("content-type") ?? "(none)"}`);
    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && ct.includes("json")) {
      const json = await res.json();
      const user = json?.data?.user ?? json?.user ?? null;
      console.log(user
        ? `  [OK] Got user: @${user.username ?? user.id}`
        : `  [WARN] No user object. Keys: ${Object.keys(json).join(", ")}`
      );
    } else {
      const text = await res.text();
      console.log(`  Body start: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`  [ERROR] ${err.message}`);
  }
}

console.log("\n=== Diagnostic complete ===\n");
