import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setTimeout(() => navigate("/login"), 1800),
    onError: (e) => setError(e.message),
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-3">
          <h1 className="text-xl font-bold text-foreground">Link inválido</h1>
          <p className="text-muted-foreground text-sm">Solicite uma nova redefinição de senha.</p>
          <button onClick={() => navigate("/forgot-password")} className="px-4 py-2 rounded-xl gradient-primary text-white text-sm">
            Recuperar senha
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-6">
      <div className="glass-card p-8 max-w-md w-full space-y-6">
        {reset.isSuccess ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <h1 className="text-xl font-bold text-foreground">Senha redefinida!</h1>
            <p className="text-muted-foreground text-sm">Todas as sessões antigas foram encerradas. Redirecionando…</p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Nova senha</h1>
              <p className="text-muted-foreground text-sm">Escolha uma senha com pelo menos 6 caracteres.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                reset.mutate({ token, newPassword: password });
              }}
              className="space-y-4"
            >
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl bg-muted/50 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
              <button type="submit" disabled={reset.isPending} className="w-full py-3 rounded-xl gradient-primary text-white font-medium text-sm disabled:opacity-60">
                {reset.isPending ? "Salvando…" : "Redefinir senha"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
