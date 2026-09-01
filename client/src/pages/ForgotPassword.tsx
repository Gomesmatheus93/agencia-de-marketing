import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const request = trpc.auth.requestPasswordReset.useMutation({
    onSettled: () => setSent(true), // resposta é sempre ok (sem enumeração)
  });

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-6">
      <div className="glass-card p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
          <p className="text-muted-foreground text-sm">
            Enviaremos um link de redefinição para o seu e-mail.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <Mail className="w-10 h-10 mx-auto text-primary" />
            <p className="text-sm text-foreground">
              Se existir uma conta com esse e-mail, o link chegará em instantes.
              Verifique também a caixa de spam.
            </p>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" /> Voltar ao login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              request.mutate({ email });
            }}
            className="space-y-4"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={request.isPending}
              className="w-full py-3 rounded-xl gradient-primary text-white font-medium text-sm disabled:opacity-60"
            >
              {request.isPending ? "Enviando…" : "Enviar link"}
            </button>
            <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
