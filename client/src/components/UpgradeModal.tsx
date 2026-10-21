import { Crown, Lock, Zap, CheckCircle2, X } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
  expired?: boolean;
}

const PRO_FEATURES = [
  "Chat com IA ilimitado",
  "Geração de vídeos com avatar",
  "Scripts para Reels",
  "Analytics do Instagram",
  "Calendário de conteúdo",
  "Automação de comentários",
  "Posts no LinkedIn e Newsletter",
  "Sem limites diários de criação",
];

export default function UpgradeModal({ open, onClose, featureName, expired }: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass-card w-full max-w-md p-8 animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
            {expired ? (
              <Lock className="w-8 h-8 text-white" />
            ) : (
              <Crown className="w-8 h-8 text-white" />
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">
              {expired ? "Trial expirado" : "Recurso do plano Pro"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {expired
                ? "Seu período de teste gratuito encerrou. Assine o plano Pro para continuar com acesso completo à plataforma."
                : featureName
                ? `${featureName} está disponível apenas nos planos pagos. Faça upgrade para desbloquear.`
                : "Este recurso está disponível apenas nos planos pagos. Faça upgrade para desbloquear."}
            </p>
          </div>

          <div className="w-full bg-muted/40 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Plano Pro inclui:</span>
            </div>
            {PRO_FEATURES.map((feat) => (
              <div key={feat} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span className="text-xs text-muted-foreground">{feat}</span>
              </div>
            ))}
          </div>

          <a
            href={import.meta.env.VITE_UPGRADE_URL || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl gradient-primary text-white font-semibold text-sm shadow-lg hover:opacity-90 transition-opacity"
          >
            <Crown className="w-4 h-4" />
            Assinar o Plano Pro
          </a>

          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Continuar no trial gratuito
          </button>
        </div>
      </div>
    </div>
  );
}
