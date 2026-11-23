import { useAuth } from "./useAuth";

// Conta restrita (accountType "limited"): só vê e edita Dashboard, Planejamento e
// Calendário. Aqui só escondemos os botões; quem bloqueia de verdade é o servidor
// (isLimitedPathAllowed em server/_core/trpc.ts).
export function useLimitedAccess() {
  const { user } = useAuth();
  return (user as { accountType?: string } | null)?.accountType === "limited";
}
