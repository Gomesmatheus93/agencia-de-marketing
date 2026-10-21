// Criptografia de campos sensíveis em repouso (AES-256-GCM) + blind index.
//
// Formato do ciphertext: "enc:v1:" + base64( iv(12) | authTag(16) | ciphertext )
//
// Leitura é retrocompatível: valores SEM o prefixo "enc:v1:" são devolvidos
// como estão (texto legado).
//
// Chaves (env):
//   ENCRYPTION_KEY   — 32 bytes em base64 (ou hex/base64url), usada no AES-256-GCM
//   BLIND_INDEX_KEY  — 32 bytes em base64, usada no HMAC-SHA256 do blind index
//
// Gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";
const IV_LEN = 12;
const TAG_LEN = 16;

function decodeKey(raw: string, label: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${label} não configurada. Gere 32 bytes: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`);
  }
  // Aceita base64, base64url ou hex; exige 32 bytes no final.
  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    buf = Buffer.from(trimmed, "hex");
  } else {
    buf = Buffer.from(trimmed, "base64");
  }
  if (buf.length !== 32) {
    throw new Error(`${label} deve decodificar para exatamente 32 bytes (recebido ${buf.length}).`);
  }
  return buf;
}

let _encKey: Buffer | null = null;
let _biKey: Buffer | null = null;

function encKey(): Buffer {
  if (!_encKey) _encKey = decodeKey(process.env.ENCRYPTION_KEY ?? "", "ENCRYPTION_KEY");
  return _encKey;
}

function biKey(): Buffer {
  if (!_biKey) _biKey = decodeKey(process.env.BLIND_INDEX_KEY ?? "", "BLIND_INDEX_KEY");
  return _biKey;
}

/** true se o valor já está no formato cifrado desta camada. */
export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Cifra um valor de texto. Passa `null`/`undefined`/"" adiante sem tocar.
 * Se o valor já estiver cifrado, devolve como está (idempotente).
 */
export function encryptField<T extends string | null | undefined>(plain: T): T {
  if (plain === null || plain === undefined || plain === "") return plain;
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64")) as T;
}

/**
 * Decifra um valor. Valores sem o prefixo são devolvidos como estão (legado).
 * Falha de decifra devolve `null` e loga — nunca lança, para não derrubar
 * uma request inteira por causa de uma linha corrompida.
 */
export function decryptField<T extends string | null | undefined>(value: T): T {
  if (value === null || value === undefined || value === "") return value;
  if (!isEncrypted(value)) return value;
  try {
    const raw = Buffer.from(String(value).slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", encKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8") as T;
  } catch (err) {
    console.error("[crypto] Falha ao decifrar campo:", String(err));
    return null as T;
  }
}

/**
 * Blind index determinístico para buscar por um valor sem decifrá-lo
 * (ex: achar um usuário pelo e-mail). Normaliza (trim + lowercase) antes.
 * Retorna 64 hex chars (cabe em varchar(64)).
 */
export function blindIndex(value: string): string {
  return createHmac("sha256", biKey())
    .update(value.trim().toLowerCase(), "utf8")
    .digest("hex");
}

/** Valida que as chaves estão presentes e no formato certo (chamar no boot). */
export function assertCryptoKeys(): void {
  encKey();
  biKey();
}
