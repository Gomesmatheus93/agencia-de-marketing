import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Zap, Image, FileText, Share2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

export default function Login() {
  const { isAuthenticated, loading, refresh } = useAuth();
  const [location, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">(location === "/register" ? "register" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  // 2FA (código por e-mail)
  const [twoFa, setTwoFa] = useState<{ challengeId: number } | null>(null);
  const [otp, setOtp] = useState("");

  // Show OAuth errors from redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailVerification = params.get("email_verification");
    if (emailVerification === "success") setNotice("E-mail confirmado com sucesso. Você já pode entrar.");
    else if (emailVerification === "invalid") setError("O link de confirmação é inválido, já foi utilizado ou expirou.");
    else if (emailVerification === "error") setError("Não foi possível confirmar o e-mail. Tente solicitar um novo link.");

    // Legacy Facebook OAuth errors
    const oauthError = params.get("error");
    if (oauthError === "oauth_denied") setError("Autorização negada pelo Instagram.");
    else if (oauthError === "oauth_failed") {
      const detail = params.get("detail");
      setError(`Erro no login com Instagram${detail ? `: ${decodeURIComponent(detail)}` : "."}`);
    } else if (oauthError === "oauth_invalid_state") setError("Sessão de login expirada. Tente novamente.");

    // Instagram Business Login errors (ig_connect param)
    const igConnect = params.get("ig_connect");
    if (igConnect === "denied") setError("Acesso negado. Autorize o app no Instagram para continuar.");
    else if (igConnect === "error") {
      const detail = params.get("detail");
      setError(`Erro no login com Instagram${detail ? `: ${decodeURIComponent(detail)}` : "."}`);
    } else if (igConnect === "invalid_state") setError("Sessão de login expirada. Tente novamente.");
  }, []);

  // Set right before a fresh registration so the auth-redirect effect below
  // sends the new user to onboarding instead of straight to the dashboard.
  const justRegisteredRef = useRef(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.needs2fa && data.challengeId != null) {
        setTwoFa({ challengeId: data.challengeId });
        return;
      }
      refresh();
    },
    onError: (e) => setError(e.message),
  });

  const verify2faMutation = trpc.auth.verify2fa.useMutation({
    onSuccess: () => { setTwoFa(null); refresh(); },
    onError: (e) => setError(e.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => { justRegisteredRef.current = true; refresh(); },
    onError: (e) => setError(e.message),
  });

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(justRegisteredRef.current ? "/dashboard/onboarding" : "/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "login") {
      loginMutation.mutate({ email: form.email, password: form.password });
    } else {
      registerMutation.mutate({ name: form.name, email: form.email, password: form.password });
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending || verify2faMutation.isPending;

  const features = [
    { icon: Zap, label: "Chat com IA", color: "from-alle-purple to-alle-purple-light" },
    { icon: Image, label: "Geração de Imagens", color: "from-alle-orange to-alle-orange-light" },
    { icon: FileText, label: "Artigos Automáticos", color: "from-emerald-500 to-teal-500" },
    { icon: Share2, label: "Automação de Posts", color: "from-orange-500 to-rose-500" },
  ];

  return (
    <div className="min-h-screen flex gradient-bg relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-alle-purple/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-alle-orange/20 blur-[100px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-alle-purple-light/15 blur-[80px] pointer-events-none" />

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative">
        <div className="flex items-center justify-center lg:justify-start">
            <img src="/logo_completa.png" 
            alt="Alle Energia"
            className="w-50 h-auto object-contain"
            />
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-5xl font-bold text-foreground leading-tight tracking-tight">
              Automatize seu
              <br />
              <span className="gradient-text">marketing com IA</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-md">
              Plataforma completa para criar conteúdo, gerenciar postagens e escalar sua presença digital com inteligência artificial.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, color }) => (
              <div key={label} className="glass-card p-4 flex items-center gap-3 group hover:scale-[1.02] transition-all duration-200">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Alle Energia. Todos os direitos reservados.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          <div className="flex lg:hidden items-center justify-center mb-8">
            <img src="/logo_completa.png" alt="Alle Energia" className="w-56 h-auto object-contain" />
          </div>

          <div className="glass-card p-8 space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                {mode === "login" ? "Bem-vindo de volta" : "Criar conta"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {mode === "login" ? "Acesse sua plataforma de marketing com IA" : "Comece a automatizar seu marketing"}
              </p>
            </div>

            {twoFa ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError("");
                  verify2faMutation.mutate({ challengeId: twoFa.challengeId, code: otp });
                }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground text-center">
                  Enviamos um código de 6 dígitos para o seu e-mail.
                </p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={isPending || otp.length < 6}
                  className="w-full py-3 px-4 rounded-xl font-medium text-sm gradient-primary text-white disabled:opacity-60"
                >
                  {isPending ? "Verificando..." : "Confirmar código"}
                </button>
                <button
                  type="button"
                  onClick={() => { setTwoFa(null); setOtp(""); setError(""); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  Voltar
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Seu nome"
                    className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-11 rounded-xl bg-muted/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
              )}
              {notice && (
                <p className="text-sm text-emerald-700 bg-emerald-500/10 px-3 py-2 rounded-lg">{notice}</p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 gradient-primary text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
              >
                <Sparkles className="w-4 h-4" />
                {isPending ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
              </button>

              {mode === "login" && (
                <div className="text-center">
                  <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
                    Esqueceu a senha?
                  </Link>
                </div>
              )}
            </form>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card/80 px-3 text-muted-foreground backdrop-blur-sm rounded-full">
                  ou continue com
                </span>
              </div>
            </div>

            <a
              href="/auth/instagram"
              className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)" }}
            >
              <InstagramIcon className="w-4 h-4" />
              Entrar com Instagram
            </a>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card/80 px-3 text-muted-foreground backdrop-blur-sm rounded-full">
                  {mode === "login" ? "Não tem conta?" : "Já tem conta?"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="w-full py-2.5 px-4 rounded-xl font-medium text-sm border border-border/50 text-foreground hover:bg-muted/50 transition-all duration-200"
            >
              {mode === "login" ? "Criar nova conta" : "Entrar com conta existente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
