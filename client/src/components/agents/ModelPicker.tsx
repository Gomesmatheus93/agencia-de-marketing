import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DESIGN_MODEL_GROUPS, DESIGN_MODELS, designModelById, type DesignModelGroup } from "@shared/designModels";
import { Check, LayoutTemplate, Sparkles } from "lucide-react";
import { useState } from "react";

/** Prévia gerada por scripts/build-model-previews.mts (client/public/modelos). */
export const modelPreview = (id: string) => `${import.meta.env.BASE_URL.replace(/\/$/, "")}/modelos/${id}.webp`;

/**
 * Botão que abre a galeria dos modelos da biblioteca de referências.
 * `value` vazio = automático (o agente escolhe o modelo).
 */
export function ModelPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<DesignModelGroup | "todos">("todos");
  const current = designModelById(value);
  const list = group === "todos" ? DESIGN_MODELS : DESIGN_MODELS.filter((m) => m.group === group);
  const pick = (id: string) => { onChange(id); setOpen(false); };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-2 text-left text-sm hover:bg-accent">
        {current
          ? <img src={modelPreview(current.id)} alt="" className="h-7 w-[22px] shrink-0 rounded-sm object-cover" />
          : <Sparkles className="h-4 w-4 shrink-0 text-primary" />}
        <span className="truncate">{current ? `${current.id} · ${current.name}` : "Automático (o agente escolhe)"}</span>
        <LayoutTemplate className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Modelos de arte</DialogTitle>
            <DialogDescription>
              30 modelos estudados das referências do setor, já no visual da Alle. Escolha um para o agente seguir ou deixe no automático.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5">
            {(["todos", ...Object.keys(DESIGN_MODEL_GROUPS)] as Array<DesignModelGroup | "todos">).map((g) => (
              <Button key={g} size="sm" variant={group === g ? "default" : "outline"} className="h-7 rounded-full px-3 text-xs" onClick={() => setGroup(g)}>
                {g === "todos" ? "Todos" : DESIGN_MODEL_GROUPS[g]}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <button type="button" onClick={() => pick("")} className={cn("flex flex-col overflow-hidden rounded-xl border-2 text-left transition hover:border-primary/60", !value ? "border-primary" : "border-transparent bg-muted/40")}>
              <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/15 to-orange-400/20 p-3 text-center">
                <Sparkles className="h-8 w-8 text-primary" />
                <span className="text-xs text-muted-foreground">O agente escolhe o modelo que combina com a pauta</span>
              </div>
              <div className="p-2"><p className="flex items-center gap-1 text-sm font-semibold">{!value && <Check className="h-3.5 w-3.5 text-primary" />}Automático</p></div>
            </button>
            {list.map((m) => (
              <button key={m.id} type="button" onClick={() => pick(m.id)} className={cn("flex flex-col overflow-hidden rounded-xl border-2 text-left transition hover:border-primary/60", value === m.id ? "border-primary" : "border-transparent bg-muted/40")}>
                <img src={modelPreview(m.id)} alt={`Prévia do modelo ${m.name}`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                <div className="space-y-0.5 p-2">
                  <p className="flex items-center gap-1 text-sm font-semibold">{value === m.id && <Check className="h-3.5 w-3.5 text-primary" />}<span className="font-mono text-xs text-muted-foreground">{m.id}</span> {m.name}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{m.summary}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
