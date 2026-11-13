import { eq } from "drizzle-orm";
import { jwtVerify } from "jose";
import { ssoUsedTokens, units, users } from "../../drizzle/schema";
import * as db from "../db";

// Login unificado com o ecossistema da Alle.
//
// O sistema da Alle gera um link  https://agencia.alleenergia.com/sso/alle?token=<JWT>
// com um JWT assinado em HS256 com o segredo ALLE_SSO_SECRET (o mesmo dos dois lados):
//
//   { "sub": "<id da pessoa no sistema da Alle>", "email": "...", "name": "...",
//     "unit_code": "<código da unidade>", "unit_name": "<nome da unidade>",
//     "iss": "alle", "aud": "agencia-alle", "iat": <agora>, "exp": <agora + até 5 min>,
//     "jti": "<id único do token>" }
//
// Na primeira vez, a plataforma cria a unidade e a conta (tipo "unit"); depois só entra.
// Cada token vale uma vez (jti) e por poucos minutos.

export class SsoError extends Error {}

const MAX_TOKEN_LIFETIME_S = 10 * 60;
const CODE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function secret() {
  const value = process.env.ALLE_SSO_SECRET ?? "";
  if (value.length < 32) throw new SsoError("Login unificado não configurado (ALLE_SSO_SECRET ausente ou curto).");
  return new TextEncoder().encode(value);
}

export type AlleSsoClaims = { sub: string; email: string; name: string; unitCode: string; unitName: string; jti: string };

/** Confere assinatura, emissor, público, validade e campos do token. */
export async function verifyAlleToken(token: string): Promise<AlleSsoClaims> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      issuer: process.env.ALLE_SSO_ISSUER || "alle",
      audience: process.env.ALLE_SSO_AUDIENCE || "agencia-alle",
      requiredClaims: ["sub", "exp", "iat", "jti"],
    }));
  } catch (err) {
    if (err instanceof SsoError) throw err;
    throw new SsoError("Link de acesso inválido ou expirado. Entre de novo pelo sistema da Alle.");
  }
  const exp = Number(payload.exp), iat = Number(payload.iat);
  if (exp - iat > MAX_TOKEN_LIFETIME_S) throw new SsoError("Link de acesso com validade longa demais.");
  const email = String(payload.email ?? "").trim().toLowerCase();
  const unitCode = String(payload.unit_code ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new SsoError("O token não traz um e-mail válido.");
  if (!CODE_RE.test(unitCode)) throw new SsoError("O token não traz um código de unidade válido.");
  return {
    sub: String(payload.sub).slice(0, 128),
    email,
    name: String(payload.name ?? "").trim().slice(0, 100) || email.split("@")[0],
    unitCode,
    unitName: String(payload.unit_name ?? "").trim().slice(0, 255) || unitCode,
    jti: String(payload.jti).slice(0, 128),
  };
}

/**
 * Cria ou atualiza a unidade e a conta e devolve o usuário para abrir a sessão.
 * Nunca transforma uma conta da equipe (standard) em conta de unidade.
 */
export async function loginWithAlleToken(token: string) {
  const claims = await verifyAlleToken(token);
  const conn = await db.getDb();
  if (!conn) throw new Error("Banco indisponível.");

  // Cada token vale uma vez.
  const used = await conn.insert(ssoUsedTokens).values({ jti: claims.jti }).onConflictDoNothing().returning({ jti: ssoUsedTokens.jti });
  if (!used.length) throw new SsoError("Este link de acesso já foi usado. Entre de novo pelo sistema da Alle.");

  // Unidade: cria na primeira vez; unidade desativada não entra.
  let [unit] = await conn.select().from(units).where(eq(units.code, claims.unitCode));
  if (!unit) [unit] = await conn.insert(units).values({ code: claims.unitCode, name: claims.unitName }).returning();
  if (!unit.active) throw new SsoError("Esta unidade está com o acesso desativado. Fale com a equipe da Alle.");

  // Conta: pela identidade no sistema da Alle; se não houver, pelo e-mail.
  const openId = `alle_sso_${claims.sub}`;
  let user = (await conn.select().from(users).where(eq(users.externalId, claims.sub)))[0] ?? null;
  if (!user) {
    const byEmail = await db.getUserByEmail(claims.email);
    if (byEmail && byEmail.accountType !== "unit") {
      throw new SsoError("Este e-mail já tem uma conta da equipe na plataforma. Use o login normal.");
    }
    if (byEmail) user = byEmail as typeof user;
  }
  if (user && user.accountType !== "unit") throw new SsoError("Conta incompatível com o acesso de unidade.");
  if (user && !user.isActive) throw new SsoError("Esta conta está desativada. Fale com a equipe da Alle.");

  if (!user) {
    await db.upsertUser({ openId, name: claims.name, email: claims.email, loginMethod: "alle_sso" });
    user = (await db.getUserByOpenId(openId)) as typeof user;
  }
  await conn.update(users).set({
    accountType: "unit", unitId: unit.id, externalId: claims.sub,
    emailVerifiedAt: user!.emailVerifiedAt ?? new Date(), lastSignedIn: new Date(),
  }).where(eq(users.id, user!.id));
  const fresh = await db.getUserById(user!.id);
  return { user: fresh!, unit };
}
