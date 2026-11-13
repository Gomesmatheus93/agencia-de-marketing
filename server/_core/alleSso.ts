import { createHash, createPublicKey, X509Certificate, type KeyObject } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { PENDING_UNIT_PREFIX, unitKey } from "./unitKey";
import { createRemoteJWKSet, importJWK, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { ssoUsedTokens, units, userUnits, users } from "../../drizzle/schema";
import * as db from "../db";

// Login unificado com o ecossistema da Alle: rota /sso recebe um JWT.
//
// Campos do token (ver docs/login-unificado-alle.md):
//   sub, email, nome, role (cargo), academias: [{ id, nome }], todas_academias, grupo_nome, exp (+ iat, jti opcionais)
//   - gestor e visualizador: 1 academia na lista;
//   - regional: todas as academias do grupo;
//   - super admin e direção: todas_academias = true e a lista vazia.
//
// Quem entra por aqui é sempre "conta de unidade": vê só o portal das academias liberadas.
// Cargos do sistema da Alle não viram administradores da plataforma.

export class SsoError extends Error {}

const DEFAULT_MAX_TTL_S = 10 * 60;
const CLOCK_SKEW_S = 60;

const claimsSchema = z.object({
  sub: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(128)),
  email: z.string().trim().toLowerCase().email().max(255),
  nome: z.string().trim().max(100).optional(),
  name: z.string().trim().max(100).optional(),
  role: z.string().trim().max(40).optional().default(""),
  academias: z.array(z.object({
    id: z.union([z.string(), z.number()]).transform((v) => String(v).trim().toLowerCase()).pipe(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "id de academia inválido")),
    nome: z.string().trim().min(1).max(255),
  })).max(500).optional().default([]),
  todas_academias: z.boolean().optional().default(false),
  grupo_nome: z.string().trim().max(255).nullish(),
  exp: z.number(),
  iat: z.number().optional(),
  jti: z.string().max(128).optional(),
});

export type AlleSsoClaims = {
  sub: string; email: string; name: string; role: string; groupName: string | null;
  allUnits: boolean; academias: Array<{ code: string; name: string }>; replayKey: string;
};

/**
 * Chaves de verificação: pública (RS256/ES256) se ALLE_SSO_PUBLIC_KEY existir; senão o segredo HS256.
 * O segredo é tentado como texto e, se tiver cara de hex ou base64, também decodificado
 * (alguns sistemas assinam com os bytes do segredo, não com o texto).
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

type VerifyKey = Uint8Array | CryptoKey | KeyObject | ReturnType<typeof createRemoteJWKSet>;

/**
 * Lê a chave pública do jeito que vier colada no painel: PEM com ou sem quebras de linha
 * (o painel às vezes troca por espaços), sem cabeçalho (só o base64), PKCS#1
 * ("BEGIN RSA PUBLIC KEY") ou certificado ("BEGIN CERTIFICATE").
 */
export function parsePublicKey(raw: string): KeyObject {
  const m = raw.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  const label = m?.[1] ?? "";
  const der = Buffer.from((m ? m[2] : raw).replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
  if (!der.length) throw new Error("chave vazia");
  if (label === "CERTIFICATE") return new X509Certificate(der).publicKey;
  const types: Array<"spki" | "pkcs1"> = label === "RSA PUBLIC KEY" ? ["pkcs1", "spki"] : ["spki", "pkcs1"];
  let last: unknown;
  for (const type of types) {
    try { return createPublicKey({ key: der, format: "der", type }); } catch (e) { last = e; }
  }
  throw last;
}

async function verificationKeys(): Promise<{ keys: VerifyKey[]; algorithms: string[] }> {
  const alg = (process.env.ALLE_SSO_ALG || "RS256").trim(); // ES256 para chave de curva elíptica
  // URL de chaves públicas (JWKS) do sistema da Alle, se eles publicarem uma.
  const jwksUrl = process.env.ALLE_SSO_JWKS_URL?.trim();
  if (jwksUrl) {
    jwks ??= createRemoteJWKSet(new URL(jwksUrl));
    return { keys: [jwks], algorithms: [alg] };
  }
  // Chave pública colada na variável: PEM (BEGIN PUBLIC KEY), certificado (BEGIN CERTIFICATE) ou JWK em JSON.
  const pub = process.env.ALLE_SSO_PUBLIC_KEY?.replace(/\\n/g, "\n").trim().replace(/^["']|["']$/g, "");
  if (pub) {
    try {
      if (pub.startsWith("{")) {
        const jwk = JSON.parse(pub);
        return { keys: [await importJWK(jwk, jwk.alg || alg)], algorithms: [jwk.alg || alg] };
      }
      return { keys: [parsePublicKey(pub)], algorithms: [alg] };
    } catch (err) {
      console.error("[sso] ALLE_SSO_PUBLIC_KEY inválida:", (err as Error).message,
        { comeco: pub.slice(0, 30), tamanho: pub.length, linhas: pub.split("\n").length });
      throw new SsoError("Login unificado mal configurado (chave pública inválida). Fale com a equipe da Alle.");
    }
  }
  const secret = (process.env.ALLE_SSO_SECRET ?? "").trim();
  if (secret.length < 32) throw new SsoError("Login unificado não configurado (ALLE_SSO_SECRET ausente ou curto).");
  const keys: Uint8Array[] = [new TextEncoder().encode(secret)];
  if (/^[0-9a-f]+$/i.test(secret) && secret.length % 2 === 0) keys.push(new Uint8Array(Buffer.from(secret, "hex")));
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(secret)) keys.push(new Uint8Array(Buffer.from(secret, "base64")));
  return { keys, algorithms: ["HS256", "HS384", "HS512"] };
}

/** Motivo curto (vai para a tela e para o log) a partir do erro do jose. */
function reasonOf(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "ERR_JWT_EXPIRED") return "token vencido";
  if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") return "assinatura não confere com o segredo";
  if (code === "ERR_JOSE_ALG_NOT_ALLOWED") return "algoritmo de assinatura não aceito";
  if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED") return `campo ${(err as { claim?: string }).claim ?? ""} inválido`.trim();
  if (code === "ERR_JWS_INVALID" || code === "ERR_JWT_INVALID") return "token mal formado";
  return code || "erro desconhecido";
}

/** Lê o cabeçalho e os nomes dos campos sem conferir (só para diagnóstico no log). */
function peek(token: string) {
  try {
    const [h, p] = token.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    return { alg: header.alg, typ: header.typ, campos: Object.keys(payload), expEmSegundos: typeof payload.exp === "number" ? payload.exp - now : payload.exp, iss: payload.iss, aud: payload.aud };
  } catch {
    return { ilegivel: true, partes: token.split(".").length, tamanho: token.length };
  }
}

/** Confere assinatura, validade e campos do token. */
export async function verifyAlleToken(token: string): Promise<AlleSsoClaims> {
  const { keys, algorithms } = await verificationKeys();
  let payload: JWTPayload | null = null;
  let lastErr: unknown = null;
  for (const key of keys) {
    try {
      ({ payload } = await jwtVerify(token, key as Parameters<typeof jwtVerify>[1], {
        algorithms,
        ...(process.env.ALLE_SSO_ISSUER ? { issuer: process.env.ALLE_SSO_ISSUER } : {}),
        ...(process.env.ALLE_SSO_AUDIENCE ? { audience: process.env.ALLE_SSO_AUDIENCE } : {}),
        requiredClaims: ["exp"],
        clockTolerance: CLOCK_SKEW_S,
      }));
      break;
    } catch (err) {
      lastErr = err;
      // Só vale tentar outra forma do segredo quando a falha é de assinatura.
      if ((err as { code?: string })?.code !== "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") break;
    }
  }
  if (!payload) {
    const reason = reasonOf(lastErr);
    console.warn("[sso] token recusado:", reason, peek(token));
    throw new SsoError(`Link de acesso inválido ou expirado (${reason}). Entre de novo pelo sistema da Alle.`);
  }

  const parsed = claimsSchema.safeParse(payload);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".") || "token";
    throw new SsoError(`O token não traz o campo "${field}" no formato esperado.`);
  }
  const c = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const maxTtl = Number(process.env.ALLE_SSO_MAX_TTL_SECONDS ?? DEFAULT_MAX_TTL_S);
  if (c.exp - now > maxTtl + CLOCK_SKEW_S) throw new SsoError("Link de acesso com validade longa demais.");
  if (!c.todas_academias && c.academias.length === 0) throw new SsoError("Nenhuma academia liberada para este usuário no sistema da Alle.");

  return {
    sub: c.sub,
    email: c.email,
    name: c.nome || c.name || c.email.split("@")[0],
    role: c.role,
    groupName: c.grupo_nome || null,
    allUnits: c.todas_academias,
    academias: c.todas_academias ? [] : c.academias.map((a) => ({ code: a.id, name: a.nome })),
    // Cada token vale uma vez: pelo jti ou, sem ele, pelo próprio token.
    replayKey: c.jti ? `jti:${c.jti}` : `sha:${createHash("sha256").update(token).digest("hex").slice(0, 100)}`,
  };
}

/**
 * Cria ou atualiza as academias e a conta, sincroniza as academias liberadas e devolve
 * o usuário para abrir a sessão. Nunca transforma uma conta da equipe em conta de unidade.
 */
export async function loginWithAlleToken(token: string) {
  const claims = await verifyAlleToken(token);
  const conn = await db.getDb();
  if (!conn) throw new Error("Banco indisponível.");

  const used = await conn.insert(ssoUsedTokens).values({ jti: claims.replayKey }).onConflictDoNothing().returning({ jti: ssoUsedTokens.jti });
  if (!used.length) throw new SsoError("Este link de acesso já foi usado. Entre de novo pelo sistema da Alle.");

  // Academias: cria as novas, atualiza nome e grupo.
  const unitIds: number[] = [];
  // Academias cadastradas pelo mídia kit ainda sem código do sistema da Alle: casam pelo nome.
  let pending: Array<typeof units.$inferSelect> | null = null;
  for (const a of claims.academias) {
    let [existing] = await conn.select().from(units).where(eq(units.code, a.code));
    if (!existing) {
      pending ??= await conn.select().from(units).where(like(units.code, `${PENDING_UNIT_PREFIX}%`));
      const match: typeof units.$inferSelect | undefined = pending.find((u) => unitKey(u.name) === unitKey(a.name));
      if (match) {
        await conn.update(units).set({ code: a.code }).where(eq(units.id, match.id));
        pending = pending.filter((u): boolean => u.id !== match.id);
        existing = { ...match, code: a.code };
      }
    }
    if (existing) {
      if (existing.name !== a.name || (claims.groupName && existing.groupName !== claims.groupName)) {
        await conn.update(units).set({ name: a.name, ...(claims.groupName ? { groupName: claims.groupName } : {}) }).where(eq(units.id, existing.id));
      }
      if (existing.active) unitIds.push(existing.id);
    } else {
      const [created] = await conn.insert(units).values({ code: a.code, name: a.name, groupName: claims.groupName }).returning({ id: units.id });
      unitIds.push(created.id);
    }
  }
  if (!claims.allUnits && unitIds.length === 0) throw new SsoError("As academias deste usuário estão com o acesso desativado. Fale com a equipe da Alle.");

  // Conta: pela identidade no sistema da Alle; se não houver, pelo e-mail.
  let user = (await conn.select().from(users).where(eq(users.externalId, claims.sub)))[0] ?? null;
  if (!user) {
    const byEmail = await db.getUserByEmail(claims.email);
    if (byEmail && byEmail.accountType !== "unit") throw new SsoError("Este e-mail já tem uma conta da equipe na plataforma. Use o login normal.");
    if (byEmail) user = byEmail as typeof user;
  }
  if (user && user.accountType !== "unit") throw new SsoError("Conta incompatível com o acesso de unidade.");
  if (user && !user.isActive) throw new SsoError("Esta conta está desativada. Fale com a equipe da Alle.");
  if (!user) {
    const openId = `alle_sso_${claims.sub}`;
    await db.upsertUser({ openId, name: claims.name, email: claims.email, loginMethod: "alle_sso" });
    user = (await db.getUserByOpenId(openId)) as typeof user;
  } else {
    await db.upsertUser({ openId: user.openId, name: claims.name }); // nome atualizado (criptografado)
  }

  // Academias liberadas: substitui pelas do token.
  await conn.delete(userUnits).where(eq(userUnits.userId, user!.id));
  if (!claims.allUnits && unitIds.length) await conn.insert(userUnits).values(unitIds.map((unitId) => ({ userId: user!.id, unitId })));

  // Academia aberta no portal: mantém a atual se ainda for permitida; senão a primeira.
  let current: number | null = user!.unitId ?? null;
  if (claims.allUnits) {
    if (current) {
      const [ok] = await conn.select({ id: units.id }).from(units).where(and(eq(units.id, current), eq(units.active, true)));
      if (!ok) current = null;
    }
    if (!current) current = (await conn.select({ id: units.id }).from(units).where(eq(units.active, true)).orderBy(units.name).limit(1))[0]?.id ?? null;
  } else if (!current || !unitIds.includes(current)) {
    current = unitIds[0];
  }

  await conn.update(users).set({
    accountType: "unit", unitId: current, externalId: claims.sub,
    externalRole: claims.role || null, groupName: claims.groupName, allUnits: claims.allUnits,
    emailVerifiedAt: user!.emailVerifiedAt ?? new Date(), lastSignedIn: new Date(),
  }).where(eq(users.id, user!.id));

  const fresh = await db.getUserById(user!.id);
  const unitRows = unitIds.length ? await conn.select().from(units).where(inArray(units.id, unitIds)) : [];
  return { user: fresh!, units: unitRows, allUnits: claims.allUnits };
}
