import { createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";
import { promisify } from "util";

const scryptLegacyAsync = promisify(scrypt);

function scryptWithOpts(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

// Parâmetros atuais do scrypt. Aumentar `N` no futuro é seguro: `needsRehash`
// detecta hashes com parâmetros antigos e o login os regrava.
const CURRENT = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };
// scrypt precisa de maxmem ~ 128 * N * r * p com folga.
const MAXMEM = 256 * CURRENT.N * CURRENT.r * CURRENT.p;

const NEW_PREFIX = "s2$";

// Pepper: aplica um HMAC no password antes do scrypt. Se PASSWORD_PEPPER não
// estiver setada, usa o password direto (compatível com hashes antigos).
function peppered(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER ?? "";
  if (!pepper) return password;
  return createHmac("sha256", pepper).update(password, "utf8").digest("base64");
}

async function derive(password: string, salt: string, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return scryptWithOpts(peppered(password), salt, keylen, { N, r, p, maxmem: MAXMEM });
}

// Formato legado: "<salt>:<hash>" (scrypt com N padrão do Node, sem pepper).
async function deriveLegacy(password: string, salt: string): Promise<Buffer> {
  // Legado nunca teve pepper — usa o password cru.
  return (await scryptLegacyAsync(password, salt, 64)) as Buffer;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, CURRENT.N, CURRENT.r, CURRENT.p, CURRENT.keylen);
  return `${NEW_PREFIX}${CURRENT.N}$${CURRENT.r}$${CURRENT.p}$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  if (stored.startsWith(NEW_PREFIX)) {
    const parts = stored.slice(NEW_PREFIX.length).split("$");
    if (parts.length !== 5) return false;
    const [nStr, rStr, pStr, salt, hashHex] = parts;
    const N = Number(nStr), r = Number(rStr), p = Number(pStr);
    if (!salt || !hashHex || !Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
    const expected = Buffer.from(hashHex, "hex");
    const derived = await derive(password, salt, N, r, p, expected.length);
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }

  // Formato legado "<salt>:<hash>"
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const derived = await deriveLegacy(password, salt);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * true quando o hash guardado deveria ser regravado — formato legado, ou
 * parâmetros do scrypt abaixo dos atuais. Chamar após um `verifyPassword` OK.
 */
export function needsRehash(stored: string): boolean {
  if (!stored || !stored.startsWith(NEW_PREFIX)) return true;
  const parts = stored.slice(NEW_PREFIX.length).split("$");
  if (parts.length !== 5) return true;
  const [nStr, rStr, pStr] = parts;
  return Number(nStr) < CURRENT.N || Number(rStr) < CURRENT.r || Number(pStr) < CURRENT.p;
}
