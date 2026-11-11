import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Bot, Copy, Link2, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Rule = { id: string; keywords: string[]; reply: string; active: boolean };
type Form = { enabled: boolean; whatsappLink: string; fallbackEnabled: boolean; fallbackMessage: string; rules: Rule[]; flowEnabled: boolean; shortSlug: string };

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
    const { defaults: _d, shortBase: _b, linkClicks: _c, ...data } = settings.data;
    setForm(data);
    setKeywordText(Object.fromEntries(settings.data.rules.map((r) => [r.id, r.keywords.join(", ")])));
  }, [settings.data, open]);

  const setRule = (id: string, patch: Partial<Rule>) =>
    setForm((f) => f && { ...f, rules: f.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const addRule = () => {
    const id = `regra-${Date.now()}`;
    setForm((f) => f && { ...f, rules: [...f.rules, { id, keywords: [], reply: "", active: true }] });
    setKeywordText((k) => ({ ...k, [id]: "" }));
  };

  const moveRule = (index: number, delta: number) =>
    setForm((f) => {
      if (!f) return f;
      const rules = [...f.rules];
      const to = index + delta;
      if (to < 0 || to >= rules.length) return f;
      [rules[index], rules[to]] = [rules[to], rules[index]];
      return { ...f, rules };
    });

  // Troca regras e resposta padrão pelas do script da Ane (só no formulário; vale ao salvar).
  const useScriptDefaults = () => {
    const d = settings.data?.defaults;
    if (!d || !form) return;
    if (!confirm("Trocar todas as regras e a resposta padrão pelas respostas do script da Ane? As regras atuais serão substituídas quando você salvar.")) return;
    setForm({ ...form, rules: d.rules, fallbackMessage: d.fallbackMessage });
    setKeywordText(Object.fromEntries(d.rules.map((r) => [r.id, r.keywords.join(", ")])));
    toast.info("Respostas do script carregadas. Revise e clique em Salvar.");
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

            <label className="flex items-center justify-between gap-3 rounded-2xl border p-4">
              <span>
                <span className="block text-sm font-semibold">Fluxo em etapas (script da Ane)</span>
                <span className="block text-xs text-muted-foreground">
                  A Ane pergunta o valor aproximado da conta de luz. Acima de R$ 200, diz que a pessoa pode ter desconto e manda para o WhatsApp; abaixo, avisa o mínimo; acima de R$ 3.000, confirma o valor. Depois de responder uma dúvida, ela retoma a pergunta do valor.
                </span>
              </span>
              <Switch checked={form.flowEnabled} onCheckedChange={(v) => setForm({ ...form, flowEnabled: v })} />
            </label>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Link do WhatsApp da Ane</p>
              <Input value={form.whatsappLink} onChange={(e) => setForm({ ...form, whatsappLink: e.target.value })} placeholder="https://wa.me/55..." />
              <p className="text-xs text-muted-foreground">Entra no lugar de <code>{"{link}"}</code> nas respostas. Sem link, o texto diz "pelo link da bio".</p>
            </div>

            <div className="space-y-1.5 rounded-2xl border p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="h-4 w-4 text-primary" />Link curto com o domínio da Alle</p>
              <div className="flex items-center gap-0 overflow-hidden rounded-md border bg-muted/40 focus-within:ring-2 focus-within:ring-ring/30">
                <span className="shrink-0 truncate px-3 text-xs text-muted-foreground">{settings.data?.shortBase}</span>
                <input
                  value={form.shortSlug}
                  onChange={(e) => setForm({ ...form, shortSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  placeholder="ane"
                  maxLength={40}
                  className="h-9 min-w-0 flex-1 bg-background px-2 text-sm outline-none"
                />
              </div>
              {settings.data?.shortSlug && settings.data.shortSlug === form.shortSlug ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">{settings.data.shortBase}{settings.data.shortSlug}</span>
                  <button type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-primary hover:bg-primary/10"
                    onClick={() => { navigator.clipboard.writeText(`${settings.data!.shortBase}${settings.data!.shortSlug}`).then(() => toast.success("Link copiado!")).catch(() => toast.error("Não consegui copiar.")); }}>
                    <Copy className="h-3 w-3" />copiar
                  </button>
                  <span className="text-muted-foreground">· {settings.data.linkClicks} {settings.data.linkClicks === 1 ? "clique" : "cliques"}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Com um apelido (ex.: <code>ane</code>), as respostas usam o link curto no lugar do link do WhatsApp, e os cliques são contados. Também dá para usar na bio e nos stories.</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Regras por palavra-chave</p>
                  <p className="text-xs text-muted-foreground">Vale a primeira regra que bater, de cima para baixo: deixe as mais específicas em cima.</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={useScriptDefaults}><RotateCcw className="h-3.5 w-3.5" />Usar script da Ane</Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={addRule}><Plus className="h-3.5 w-3.5" />Nova regra</Button>
                </div>
              </div>
              {form.rules.map((r, i) => (
                <div key={r.id} className={cn("space-y-2 rounded-2xl border p-4", !r.active && "opacity-60")}>
                  <div className="flex items-center gap-2">
                    <Input
                      value={keywordText[r.id] ?? ""}
                      onChange={(e) => setKeywordText((k) => ({ ...k, [r.id]: e.target.value }))}
                      placeholder="Palavras-chave separadas por vírgula (ex.: preço, desconto, quanto)"
                      className="flex-1"
                    />
                    <button type="button" onClick={() => moveRule(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Subir regra"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveRule(i, 1)} disabled={i === form.rules.length - 1} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Descer regra"><ArrowDown className="h-4 w-4" /></button>
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
