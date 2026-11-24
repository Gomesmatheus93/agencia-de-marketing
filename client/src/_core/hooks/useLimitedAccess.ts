import { useAuth } from "./useAuth";

// Conta restrita (accountType "limited"): só o Dashboard e as artes liberadas para a
// pessoa (users.allowedThreads). Aqui só escondemos os botões; quem bloqueia de verdade
// é o servidor (isLimitedPathAllowed em server/_core/trpc.ts).
export function useLimitedAccess() {
  const { user } = useAuth();
  return (user as { accountType?: string } | null)?.accountType === "limited";
}
