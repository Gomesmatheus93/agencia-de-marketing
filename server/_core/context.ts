import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  // Quem de fato logou — identidade (nome, email, se é dono ou funcionário).
  actualUser: User | null;
  // Dono efetivo do conteúdo: igual a actualUser pra contas principais; pra
  // funcionários (actualUser.companyOwnerId setado), é a conta principal.
  // Todo o resto do app usa ctx.user pra ownership — isso é o único ponto
  // que faz um funcionário operar sobre o conteúdo da empresa dele.
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let actualUser: User | null = null;

  try {
    actualUser = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    actualUser = null;
  }

  let user = actualUser;
  if (actualUser?.companyOwnerId) {
    const owner = await db.getUserById(actualUser.companyOwnerId);
    if (owner && owner.isActive) user = owner;
  }

  return {
    req: opts.req,
    res: opts.res,
    actualUser,
    user,
  };
}
