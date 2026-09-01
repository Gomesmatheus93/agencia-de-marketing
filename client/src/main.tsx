import { trpc } from "@/lib/trpc";
import { EMAIL_UNVERIFIED_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// Páginas públicas onde um 401 é esperado (ex: auth.me antes de logar) —
// redirecionar aqui causaria um loop de reload em vez de deixar o usuário
// enviar o formulário.
const PUBLIC_PATHS = ["/app/login", "/app/register"];

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  // E-mail não confirmado → tela de "confirme seu e-mail".
  if (error.message === EMAIL_UNVERIFIED_ERR_MSG) {
    if (window.location.pathname !== "/app/verify-email-pending") {
      window.location.href = "/app/verify-email-pending";
    }
    return;
  }

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;
  if (PUBLIC_PATHS.includes(window.location.pathname)) return;

  window.location.href = "/app/login";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)app_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// Renova o access token (via refresh cookie) no máximo uma vez por rajada de 401s.
let refreshPromise: Promise<boolean> | null = null;

function tryRefreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = globalThis
      .fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        credentials: "include",
        body: "{}",
      })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        // Deixa a promise disponível por um instante para deduplicar a rajada,
        // depois limpa para permitir um novo refresh no futuro.
        setTimeout(() => { refreshPromise = null; }, 500);
      });
  }
  return refreshPromise;
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const doFetch = () =>
          globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
            headers: { ...(init?.headers ?? {}), "x-csrf-token": readCsrfToken() },
          });

        let res = await doFetch();
        // 401 numa rota autenticada → tenta renovar a sessão e repetir 1x.
        if (res.status === 401) {
          const refreshed = await tryRefreshSession();
          if (refreshed) res = await doFetch();
        }
        return res;
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
