import { TRPCError } from "@trpc/server";
import * as db from "../db";
import type { Company } from "../../drizzle/schema";

type CompanyAccessUser = {
  email: string | null;
  emailDomain?: string | null;
  role?: string | null;
  loginMethod?: string | null;
};

export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

// Company-domain matching only means anything if we know the user actually
// owns that mailbox. Self-service email/password registration never proves
// that (no confirmation step) — so an account created that way can't be
// trusted to unlock a company's private templates just by typing an
// @empresa.com address. OAuth logins (Instagram/Facebook) only hand back an
// email the provider itself has already verified, so those are trusted.
function hasVerifiedEmail(user: CompanyAccessUser): boolean {
  return !!user.loginMethod && user.loginMethod !== "email";
}

export async function getUserCompany(user: CompanyAccessUser): Promise<Company | null> {
  if (!hasVerifiedEmail(user)) return null;
  // Prefere a coluna emailDomain (texto puro) — o email agora é ciphertext.
  const domain = user.emailDomain?.trim().toLowerCase() || domainFromEmail(user.email);
  if (!domain) return null;
  return db.getCompanyByDomain(domain);
}

// Lança FORBIDDEN a menos que o usuário seja admin ou pertença a uma empresa
// (e-mail bate com um domínio cadastrado). Retorna a empresa encontrada (ou
// null quando é admin sem empresa vinculada) para o caller filtrar dados por ela.
export async function requireCompanyAccess(user: CompanyAccessUser): Promise<Company | null> {
  if (user.role === "admin") {
    return getUserCompany(user);
  }
  const company = await getUserCompany(user);
  if (!company) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este recurso está disponível apenas para contas da sua empresa.",
    });
  }
  return company;
}
