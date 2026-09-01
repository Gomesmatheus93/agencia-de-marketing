import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setStatus("ok");
      setTimeout(() => navigate("/dashboard"), 1800);
    },
    onError: (e) => {
      setStatus("error");
      setMessage(e.message);
    },
  });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("Link sem token. Solicite um novo e-mail de verificação.");
      return;
    }
    verify.mutate({ token });
  }, [verify]);

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-6">
      <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
            <p className="text-foreground">Confirmando seu e-mail…</p>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <h1 className="text-xl font-bold text-foreground">E-mail confirmado!</h1>
            <p className="text-muted-foreground text-sm">Redirecionando para o painel…</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-bold text-foreground">Não foi possível confirmar</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-2 px-4 py-2 rounded-xl border border-border/50 text-sm text-foreground hover:bg-muted/50"
            >
              Ir para o painel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
