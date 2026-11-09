import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bot, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Rule = { id: string; keywords: string[]; reply: string; active: boolean };
type Form = { enabled: boolean; whatsappLink: string; fallbackEnabled: boolean; fallbackMessage: string; rules: Rule[] };

/** Configuração das respostas automáticas do Direct (por palavra-chave, sem IA). */
export function DmAutoReplyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const settings = trpc.dmAutoReply.get.useQuery(undefined, { enabled: open });
  const save = trpc.dmAutoReply.save.useMutation({
    onSuccess: () => { toast.success("Respostas automáticas salvas."); settings.refetch(); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });
  const [form, setForm] = useState<Form | null>(null);
  const [keywordText, setKeywordText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!settings.data || !open) return;
    setForm(settings.data);
    setKeywordText(Object.fromEntries(settings.data.rules.map((r) => [r.id, r.keywords.join(", ")])));
  }, [settings.data, open]);

  const setRule = (id: string, patch: Partial<Rule>) =>
    setForm((f) => f && { ...f, rules: f.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const addRule = () => {
    const id = `regra-${Date.now()}`;
    setForm((f) => f && { ...f, rules: [...f.rules, { id, keywords: [], reply: "", active: true }] });
    setKeywordText((k) => ({ ...k, [id]: "" }));
  };

  const submit = () => {
    if (!form) return;
    const rules = form.rules
      .map((r) => ({ ...r, keywords: (keywordText[r.id] ?? "").split(",").map((k) => k.trim()).filter(Boolean) }))
      .filter((r) => r.keywords.length && r.reply.trim());
    save.mutate({ ...form, rules });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Respostas automáticas</DialogTitle>
          <DialogDescription>
            Responde as DMs por palavra-chave, sem IA e sem custo. Cada regra responde a mesma pessoa no máximo 1 vez a cada 12 h; a resposta padrão, 1 vez a cada 24 h.
          </DialogDescription>
        </DialogHeader>

        {!form ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
        ) : (
          <div className="space-y-5">
            <label className="flex items-center justify-between gap-3 rounded-2xl border p-4">
              <span>
                <span className="block text-sm font-semibold">Ligar respostas automáticas</span>
                <span className="block text-xs text-muted-foreground">Mensagens de automações de comentário continuam seguindo o fluxo delas.</span>
              </span>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            </label>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Link do WhatsApp da Ane</p>
              <Input value={form.whatsappLink} onChange={(e) => setForm({ ...form, whatsappLink: e.target.value })} placeholder="https://wa.me/55..." />
              <p className="text-xs text-muted-foreground">Entra no lugar de <code>{"{link}"}</code> nas respostas. Sem link, o texto diz "pelo link da bio".</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Regras por palavra-chave</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={addRule}><Plus className="h-3.5 w-3.5" />Nova regra</Button>
              </div>
              {form.rules.map((r) => (
                <div key={r.id} className={cn("space-y-2 rounded-2xl border p-4", !r.active && "opacity-60")}>
                  <div className="flex items-center gap-2">
                    <Input
                      value={keywordText[r.id] ?? ""}
                      onChange={(e) => setKeywordText((k) => ({ ...k, [r.id]: e.target.value }))}
                      placeholder="Palavras-chave separadas por vírgula (ex.: preço, desconto, quanto)"
                      className="flex-1"
                    />
                    <Switch checked={r.active} onCheckedChange={(v) => setRule(r.id, { active: v })} aria-label="Regra ativa" />
                    <button type="button" onClick={() => setForm({ ...form, rules: form.rules.filter((x) => x.id !== r.id) })} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Apagar regra">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea rows={4} value={r.reply} onChange={(e) => setRule(r.id, { reply: e.target.value })} placeholder="Resposta enviada quando a mensagem tiver uma dessas palavras" className="text-sm" />
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl border p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Resposta padrão (quando nenhuma regra bate)</span>
                <Switch checked={form.fallbackEnabled} onCheckedChange={(v) => setForm({ ...form, fallbackEnabled: v })} />
              </label>
              <Textarea rows={3} value={form.fallbackMessage} onChange={(e) => setForm({ ...form, fallbackMessage: e.target.value })} className="text-sm" disabled={!form.fallbackEnabled} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={save.isPending} className="gap-1.5">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
