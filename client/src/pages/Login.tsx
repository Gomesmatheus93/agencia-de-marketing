import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, Zap, Image, FileText, Share2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { isAuthenticated, loading, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => { refresh(); navigate("/dashboard"); },
    onError: (e) => setError(e.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => { refresh(); navigate("/dashboard"); },
    onError: (e) => setError(e.message),
  });

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/dashboard");
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

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const features = [
    { icon: Zap, label: "Chat com IA", color: "from-violet-500 to-purple-600" },
    { icon: Image, label: "Geração de Imagens", color: "from-blue-500 to-cyan-500" },
    { icon: FileText, label: "Artigos Automáticos", color: "from-emerald-500 to-teal-500" },
    { icon: Share2, label: "Automação de Posts", color: "from-orange-500 to-rose-500" },
  ];

  return (
    <div className="min-h-screen flex gradient-bg relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-400/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400/20 blur-[100px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-purple-300/15 blur-[80px] pointer-events-none" />

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative">
        <div className="flex items-center justify-center lg:justify-start">
            <img src="/logo_completa.png" 
            alt="logokrythos"
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

        <p className="text-sm text-muted-foreground">© 2025 KrythosLab. Todos os direitos reservados.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">KrythosLab</span>
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

              <button
                type="submit"
                disabled={isPending}
                className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 gradient-primary text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
              >
                <Sparkles className="w-4 h-4" />
                {isPending ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
              </button>
            </form>

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
