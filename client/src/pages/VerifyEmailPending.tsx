import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { MailCheck } from "lucide-react";

export default function VerifyEmailPending() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [sent, setSent] = useState(false);

  const resend = trpc.auth.resendVerification.useMutation({
    onSuccess: (r) => {
      if (r.alreadyVerified) navigate("/dashboard");
      else setSent(true);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-6">
      <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
        <MailCheck className="w-12 h-12 mx-auto text-primary" />
        <h1 className="text-xl font-bold text-foreground">Confirme seu e-mail</h1>
        <p className="text-muted-foreground text-sm">
          Enviamos um link de confirmação para <strong>{user?.email ?? "seu e-mail"}</strong>.
          Clique nele para liberar o acesso à plataforma.
        </p>

        {sent && (
          <p className="text-sm text-emerald-600 bg-emerald-500/10 px-3 py-2 rounded-lg">
            Novo e-mail enviado. Verifique a caixa de entrada e o spam.
          </p>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="w-full py-2.5 rounded-xl gradient-primary text-white text-sm font-medium disabled:opacity-60"
          >
            {resend.isPending ? "Enviando…" : "Reenviar e-mail"}
          </button>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full py-2.5 rounded-xl border border-border/50 text-sm text-foreground hover:bg-muted/50"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
