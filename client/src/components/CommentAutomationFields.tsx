import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { MessageSquareReply } from "lucide-react";
import { useEffect, useState } from "react";

export type CommentAutomationValue = {
  keywords: string[];
  publicReplyMessage: string;
  dmFirstMessage: string;
  dmFollowupMessage?: string;
  dmLink?: string;
};

/**
 * Automação de comentários para um post que ainda vai ser publicado: fica
 * "aguardando publicação" e liga sozinha quando o post sair. `value` null = desligada.
 */
export function CommentAutomationFields({ value, onChange, className }: {
  value: CommentAutomationValue | null;
  onChange: (v: CommentAutomationValue | null) => void;
  className?: string;
}) {
  const template = trpc.commentAutomations.lastTemplate.useQuery(undefined, { staleTime: 5 * 60_000 });
  const [keywordText, setKeywordText] = useState("");
  useEffect(() => { if (value) setKeywordText(value.keywords.join(", ")); }, [value === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const turnOn = () => {
    const t = template.data;
    onChange({
      keywords: t?.keywords ?? ["energia"],
      publicReplyMessage: t?.publicReplyMessage ?? "",
      dmFirstMessage: t?.dmFirstMessage ?? "",
      dmFollowupMessage: t?.dmFollowupMessage ?? "",
      dmLink: t?.dmLink ?? "",
    });
  };
  const set = (patch: Partial<CommentAutomationValue>) => value && onChange({ ...value, ...patch });

  return (
    <div className={cn("space-y-2 rounded-xl border p-3", className)}>
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-medium"><MessageSquareReply className="h-3.5 w-3.5 text-primary" />Automação de comentários quando publicar</span>
        <Switch checked={value !== null} onCheckedChange={(on) => (on ? turnOn() : onChange(null))} disabled={template.isLoading} />
      </label>
      {value && (
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Palavras-chave (separadas por vírgula)</p>
            <Input value={keywordText} placeholder="energia"
              onChange={(e) => { setKeywordText(e.target.value); set({ keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) }); }} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Resposta pública no comentário</p>
            <Textarea rows={2} value={value.publicReplyMessage} onChange={(e) => set({ publicReplyMessage: e.target.value })} className="text-sm" />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Primeira mensagem no Direct</p>
            <Textarea rows={2} value={value.dmFirstMessage} onChange={(e) => set({ dmFirstMessage: e.target.value })} className="text-sm" />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Segunda mensagem (quando a pessoa responder) + link</p>
            <Textarea rows={2} value={value.dmFollowupMessage ?? ""} onChange={(e) => set({ dmFollowupMessage: e.target.value })} className="text-sm" />
            <Input value={value.dmLink ?? ""} onChange={(e) => set({ dmLink: e.target.value })} placeholder="https://agencia.alleenergia.com/wa/ane" className="mt-1.5" />
          </div>
          <p className="text-[11px] text-muted-foreground">Fica como "aguardando publicação" em Automação de Comentários e liga sozinha quando o post sair.</p>
        </div>
      )}
    </div>
  );
}

/** Pronta para enviar ao servidor? (palavra-chave, resposta pública e primeira DM preenchidas) */
export function commentAutomationReady(v: CommentAutomationValue | null) {
  return !v || (v.keywords.length > 0 && v.publicReplyMessage.trim() !== "" && v.dmFirstMessage.trim() !== "");
}
