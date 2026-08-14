import { TRPCError } from "@trpc/server";
import * as db from "../db";
import type { Company } from "../../drizzle/schema";

type CompanyAccessUser = { email: string | null; role?: string | null };

export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export async function getUserCompany(user: CompanyAccessUser): Promise<Company | null> {
  const domain = domainFromEmail(user.email);
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
