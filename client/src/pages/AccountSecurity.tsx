import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ShieldCheck, Smartphone, LogOut, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function AccountSecurity() {
  const { isAuthenticated, loading, logoutAllDevices } = useAuth();
  const [, navigate] = useLocation();

  const statusQuery = trpc.auth.twoFactor.status.useQuery(undefined, { enabled: isAuthenticated });
  const [setupMode, setSetupMode] = useState(false);
  const [code, setCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  const requestSetup = trpc.auth.twoFactor.requestSetup.useMutation({
    onSuccess: () => { setSetupMode(true); toast.success("Código enviado para o seu e-mail"); },
    onError: (e) => toast.error(e.message),
  });
  const confirmSetup = trpc.auth.twoFactor.confirmSetup.useMutation({
    onSuccess: () => { setSetupMode(false); setCode(""); statusQuery.refetch(); toast.success("2FA ativado"); },
    onError: (e) => toast.error(e.message),
  });
  const disable = trpc.auth.twoFactor.disable.useMutation({
    onSuccess: () => { setDisablePassword(""); statusQuery.refetch(); toast.success("2FA desativado"); },
    onError: (e) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) { navigate("/login"); return null; }

  const enabled = statusQuery.data?.enabled ?? false;

  return (
    <div className="min-h-screen gradient-bg p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Segurança da conta
        </h1>

        {/* 2FA */}
        <section className="glass-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold text-foreground">Verificação em duas etapas</h2>
              <p className="text-sm text-muted-foreground">
                Ao entrar, pedimos um código de 6 dígitos enviado para o seu e-mail.
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>

          {!enabled && !setupMode && (
            <button
              onClick={() => requestSetup.mutate()}
              disabled={requestSetup.isPending}
              className="w-full py-2.5 rounded-xl gradient-primary text-white text-sm font-medium disabled:opacity-60"
            >
              {requestSetup.isPending ? "Enviando código…" : "Ativar 2FA"}
            </button>
          )}

          {!enabled && setupMode && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Digite o código que enviamos:</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <button
                onClick={() => confirmSetup.mutate({ code })}
                disabled={confirmSetup.isPending || code.length < 6}
                className="w-full py-2.5 rounded-xl gradient-primary text-white text-sm font-medium disabled:opacity-60"
              >
                {confirmSetup.isPending ? "Confirmando…" : "Confirmar"}
              </button>
            </div>
          )}

          {enabled && (
            <div className="space-y-2">
              <input
                type="password"
                placeholder="Sua senha para desativar"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={() => disable.mutate({ password: disablePassword })}
                disabled={disable.isPending || !disablePassword}
                className="w-full py-2.5 rounded-xl border border-destructive/40 text-destructive text-sm font-medium disabled:opacity-60"
              >
                Desativar 2FA
              </button>
            </div>
          )}
        </section>

        {/* Sessões */}
        <section className="glass-card p-6 space-y-3">
          <div className="flex items-start gap-3">
            <LogOut className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold text-foreground">Sessões ativas</h2>
              <p className="text-sm text-muted-foreground">
                Desconecta a conta de todos os aparelhos e navegadores.
              </p>
            </div>
          </div>
          <button
            onClick={async () => { await logoutAllDevices(); toast.success("Sessões encerradas"); }}
            className="w-full py-2.5 rounded-xl border border-border/50 text-sm text-foreground hover:bg-muted/50"
          >
            Sair de todos os dispositivos
          </button>
        </section>

        <button onClick={() => navigate("/dashboard")} className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao painel
        </button>
      </div>
    </div>
  );
}
