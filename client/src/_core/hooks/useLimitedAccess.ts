import { useAuth } from "./useAuth";

// Contas que só olham. Aqui só escondemos os botões; quem bloqueia de verdade é o
// servidor (isLimitedPathAllowed e isViewerPathAllowed em server/_core/trpc.ts).
// - "limited" (Giovanna e Julio): só o Dashboard e as artes liberadas, que podem editar.
// - "viewer" (desde 25/11/2026): Dashboard, Planejamento, Calendário e Histórico, só visualizar.

function useAccountType() {
  const { user } = useAuth();
  return (user as { accountType?: string } | null)?.accountType;
}

/** Conta restrita ou visualizador: telas em modo leitura (sem criar, gerar, enviar ou excluir). */
export function useLimitedAccess() {
  const type = useAccountType();
  return type === "limited" || type === "viewer";
}

/** Visualizador: além do modo leitura, não edita nada (nem arte, legenda ou pauta). */
export function useViewerAccess() {
  return useAccountType() === "viewer";
}
